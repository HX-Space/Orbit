import { query, queryOne } from "@/lib/db";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { regionFromStrategyProjectSlug } from "@/lib/employee-create-projects";
import { baseCountryFromDisplay } from "@/lib/overview-country-display";
import { regionKeySql } from "@/lib/project-region-sql";
import type { OpAccessScope, OpProjectAccess } from "@/types/admin";

const EMPTY_SCOPE: OpAccessScope = {
  projects: [],
  projectSlug: "",
  region: "Africa",
  countries: [],
};

/** Build the scope from per-project rows (first project = the OP's main one). */
export function opScopeFromProjects(projects: OpProjectAccess[]): OpAccessScope {
  const first = projects[0];
  if (!first) return EMPTY_SCOPE;
  return {
    projects,
    projectSlug: first.projectSlug,
    region: first.region,
    countries: [...new Set(projects.flatMap((project) => project.countries))],
  };
}

export async function fetchOpAccessScope(
  opUserId: number
): Promise<OpAccessScope | null> {
  if (!Number.isFinite(opUserId)) return null;

  const user = await queryOne<{ op_project_slug: string | null; role: string }>(
    `SELECT op_project_slug, role FROM temp_users WHERE id = $1`,
    [opUserId]
  );
  if (!user || user.role !== "op") return null;
  const mainSlug = (user.op_project_slug ?? "").trim();

  let rows: { project_slug: string; country: string }[];
  try {
    rows = await query<{ project_slug: string; country: string }>(
      `SELECT COALESCE(NULLIF(TRIM(project_slug), ''), $2) AS project_slug, country
         FROM temp_op_countries
        WHERE user_id = $1
        ORDER BY country ASC`,
      [opUserId, mainSlug]
    );
  } catch (error) {
    // Before migration 0029: one project per OP.
    if ((error as { code?: string }).code !== "42703") throw error;
    rows = (
      await query<{ country: string }>(
        `SELECT country FROM temp_op_countries WHERE user_id = $1 ORDER BY country ASC`,
        [opUserId]
      )
    ).map((row) => ({ project_slug: mainSlug, country: row.country }));
  }

  if (!mainSlug && rows.length === 0) return EMPTY_SCOPE;

  const catalog = await fetchEmployeeCreateProjectOptions();
  const bySlug = new Map<string, string[]>();
  if (mainSlug) bySlug.set(mainSlug, []);
  for (const row of rows) {
    const slug = row.project_slug.trim();
    const country = row.country.trim();
    if (!slug || !country) continue;
    const list = bySlug.get(slug) ?? [];
    list.push(country);
    bySlug.set(slug, list);
  }

  return opScopeFromProjects(
    [...bySlug.entries()].map(([slug, countries]) => ({
      projectSlug: slug,
      region: regionFromStrategyProjectSlug(slug, catalog) || slug,
      countries,
    }))
  );
}

/** The OP's access for one project, or null when that project isn't theirs. */
export function opScopeProject(
  scope: OpAccessScope | null | undefined,
  projectSlug: string
): OpProjectAccess | null {
  return scope?.projects.find((project) => project.projectSlug === projectSlug) ?? null;
}

function regionKey(value: string | null | undefined) {
  const key = value?.trim().toLowerCase() ?? "";
  return key === "balkan" ? "europe" : key;
}

/**
 * True when a person (project + country) is inside one of the OP's projects.
 * A blank project only needs the country (old rows without a project).
 */
export function opScopeIncludes(
  scope: OpAccessScope | null | undefined,
  region: string | null | undefined,
  country: string | null | undefined
): boolean {
  if (!scope) return true;
  if (!country) return false;
  const base = baseCountryFromDisplay(country);
  const key = regionKey(region);
  return scope.projects.some(
    (project) =>
      (!key || regionKey(project.region) === key) &&
      (project.countries.includes(base) || project.countries.includes(country))
  );
}

/**
 * SQL predicate for "person is in one of the OP's projects and countries".
 * Pushes its parameters onto `values`.
 */
export function opScopeSql(
  scope: OpAccessScope,
  values: unknown[],
  regionColumn: string,
  countryColumn: string
): string {
  const parts = scope.projects
    .filter((project) => project.countries.length > 0)
    .map((project) => {
      values.push(project.countries);
      const countries = `$${values.length}::text[]`;
      values.push(regionKey(project.region));
      const region = `$${values.length}::text`;
      return `(${countryColumn} = ANY(${countries})
        AND (${regionKeySql(regionColumn)} = ${region} OR ${regionKeySql(regionColumn)} = ''))`;
    });
  return parts.length > 0 ? `(${parts.join(" OR ")})` : "FALSE";
}
