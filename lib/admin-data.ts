import { fetchEmployeeSharedSettings } from "@/lib/shared-employees-data";
import { fetchSharedPlaceOptions } from "@/lib/admin-accounts-data";
import { sharedPlaceKey } from "@/lib/shared-places";
import { query, queryOne } from "@/lib/db";
import {
  addDaysToIsoDate,
  formatShortDate,
  getTodayCairoDate,
  normalizePgDateColumn,
} from "@/lib/cairo-date";
import {
  commandPalettePeopleFromRows,
  type CommandPaletteAccountRow,
} from "@/lib/admin-command-palette";
import type {
  AdminEmployeeEditorBundle,
  AdminEmployeeListFilters,
  AdminEmployeeListRow,
  AdminEmployeeSource,
  EmployeeActivityItem,
  EmployeeFormInitial,
  OpProjectAccessInput,
} from "@/types/admin";
import type { CommandPalettePerson } from "@/types/layout";
import {
  fetchAlphaaEmployeeEditorBundle,
  fetchAlphaaEmployeesList,
} from "@/lib/admin-alphaa-employees-data";
import { adminEmployeeProjectLabel } from "@/lib/admin-view";
import {
  TEMP_MANAGER_NAME_SQL,
  TEMP_TEAM_LEAD_NAME_SQL,
} from "@/lib/admin-employee-reporting";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { fetchManagerOptions } from "@/lib/manager-data";
import { baseCountryFromDisplay, mapEmployeeListCountries } from "@/lib/overview-country-display";
import { regionDisplayLabel } from "@/lib/project-labels";
import { setupCountriesForRegion } from "@/lib/setup-options";
import type { TempUser } from "@/types/db";

export type AdminHealthMetrics = {
  avgQcTurnaroundHours: number | null;
  submissionCompletionRate: number | null;
  lastCronRunLabel: string | null;
};

export async function fetchAdminHealthMetrics(): Promise<AdminHealthMetrics> {
  const today = getTodayCairoDate();
  const sevenAgo = addDaysToIsoDate(today, -7);

  const [turnRow, rateRow, cronRow] = await Promise.all([
    queryOne<{ h: string | null }>(
      `SELECT EXTRACT(EPOCH FROM AVG(g.qc_reviewed_at - g.submitted_at)) / 3600 AS h
         FROM temp_growth g
        WHERE g.qc_status = 'approved'
          AND g.submitted_at IS NOT NULL
          AND g.qc_reviewed_at IS NOT NULL
          AND g.qc_reviewed_at::date >= $1::date`,
      [sevenAgo]
    ),
    queryOne<{ done: string; tot: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE qc_status <> 'pending')::text AS done,
         COUNT(*)::text AS tot
         FROM temp_growth
        WHERE submission_date::date >= $1::date`,
      [sevenAgo]
    ),
    queryOne<{ ts: string | null }>(
      `SELECT MAX(created_at)::text AS ts FROM temp_growth WHERE is_auto_reset = TRUE`
    ),
  ]);

  const tot = Number(rateRow?.tot ?? 0);
  const done = Number(rateRow?.done ?? 0);
  const rate = tot > 0 ? done / tot : null;
  const h = turnRow?.h != null ? Number(turnRow.h) : null;

  return {
    avgQcTurnaroundHours: h != null && Number.isFinite(h) ? h : null,
    submissionCompletionRate: rate,
    lastCronRunLabel:
      cronRow?.ts != null ? formatShortDate(cronRow.ts) : null,
  };
}

/** A shared employee also works in one of these projects (extra place). */
function sharedPlaceRegionSql(regionsArraySql: string) {
  return `(u.is_shared = TRUE AND EXISTS (
    SELECT 1 FROM temp_user_extra_assignments x
     WHERE x.user_id = u.id
       AND LOWER(TRIM(x.region)) IN (SELECT LOWER(TRIM(r)) FROM unnest(${regionsArraySql}) r)
  ))`;
}

export async function fetchAdminEmployeesList(
  filters: AdminEmployeeListFilters
): Promise<AdminEmployeeListRow[]> {
  const q = filters.q?.trim() ?? "";
  const status = filters.status ?? "all";
  const role = filters.role ?? "all";
  const country = filters.country?.trim() ?? "";
  const region = filters.region;
  const teamLeadId = filters.teamLeadId;

  const params: unknown[] = [];
  const where: string[] = [
    `u.role IN ('employee', 'manager', 'team_lead', 'op', 'hoo', 'admin')`,
  ];

  if (
    role === "employee" ||
    role === "manager" ||
    role === "team_lead" ||
    role === "op" ||
    role === "hoo" ||
    role === "admin"
  ) {
    params.push(role);
    where.push(`u.role = $${params.length}`);
  }
  if (region === "Africa" || region === "Europe" || region === "Asia") {
    const regionAliases =
      region === "Europe" ? ["Europe", "Balkan"] : [region];
    params.push(regionAliases);
    const regionParam = params.length;
    params.push([...setupCountriesForRegion(region)]);
    const countriesParam = params.length;
    // A person's own region decides the list they belong to. The country match is
    // only a fallback for people with no region, otherwise shared countries
    // (Sudan, Somalia, Palestine) pull Main staff into Africa / Asia.
    where.push(
      `(u.region = ANY($${regionParam}::text[])
        OR ${sharedPlaceRegionSql(`$${regionParam}::text[]`)}
        OR (
          COALESCE(TRIM(u.region), '') = ''
          AND (
            INITCAP(TRIM(COALESCE(u.country, ''))) = ANY($${countriesParam}::text[])
            OR EXISTS (
                SELECT 1 FROM temp_manager_countries mc
                 WHERE mc.user_id = u.id
                   AND mc.country = ANY($${countriesParam}::text[])
              )
          )
        ))`
    );
  } else if (region === "Alphaa") {
    params.push(["Alphaa"]);
    where.push(
      `(u.region = ANY($${params.length}::text[])
        OR ${sharedPlaceRegionSql(`$${params.length}::text[]`)})`
    );
  } else if (region?.trim()) {
    // A project created in Strategy: people saved with its name.
    params.push(region.trim());
    where.push(
      `(LOWER(TRIM(COALESCE(u.region, ''))) = LOWER($${params.length})
        OR ${sharedPlaceRegionSql(`ARRAY[$${params.length}]::text[]`)})`
    );
  }
  if (country) {
    params.push(country);
    const i = params.length;
    // Match the countries the table shows: own country, managed countries and
    // Operation Manager countries (case/space-insensitive), and a shared
    // employee's extra places.
    where.push(
      `(LOWER(TRIM(COALESCE(u.country, ''))) = LOWER(TRIM($${i}))
        OR (u.is_shared = TRUE AND EXISTS (
          SELECT 1 FROM temp_user_extra_assignments x
           WHERE x.user_id = u.id AND LOWER(TRIM(x.country)) = LOWER(TRIM($${i}))
        ))
        OR EXISTS (
          SELECT 1 FROM temp_manager_countries mc
           WHERE mc.user_id = u.id AND LOWER(TRIM(mc.country)) = LOWER(TRIM($${i}))
        )
        OR EXISTS (
          SELECT 1 FROM temp_op_countries oc
           WHERE oc.user_id = u.id AND LOWER(TRIM(oc.country)) = LOWER(TRIM($${i}))
        ))`
    );
  }
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(
      `(u.full_name ILIKE $${i}
        OR u.email ILIKE $${i}
        OR COALESCE(u.country, '') ILIKE $${i}
        OR COALESCE(u.employee_code, '') ILIKE $${i}
        OR REPLACE(u.role::text, '_', ' ') ILIKE $${i}
        OR EXISTS (
            SELECT 1 FROM temp_manager_countries mc
             WHERE mc.user_id = u.id AND mc.country ILIKE $${i}
          )
        OR EXISTS (
            SELECT 1
              FROM temp_social_media_accounts s
             WHERE s.user_id = u.id
               AND (
                 s.account_name ILIKE $${i}
                 OR COALESCE(s.account_handle, '') ILIKE $${i}
                 OR s.account_url ILIKE $${i}
                 OR COALESCE(s.username, '') ILIKE $${i}
                 OR COALESCE(s.account_email, '') ILIKE $${i}
                 OR s.platform::text ILIKE $${i}
               )
          ))`
    );
  }
  if (status === "active") where.push(`u.is_active = TRUE`);
  if (status === "inactive") where.push(`u.is_active = FALSE`);
  if (teamLeadId != null && Number.isFinite(teamLeadId)) {
    params.push(teamLeadId);
    where.push(`u.team_lead_id = $${params.length}`);
  }

  const sql = `
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.role,
      u.is_active,
      u.employee_code,
      u.employment_status,
      u.team_lead_id,
      ${TEMP_TEAM_LEAD_NAME_SQL} AS team_lead_name,
      u.manager_id,
      ${TEMP_MANAGER_NAME_SQL} AS manager_name,
      u.op_id,
      op_u.full_name AS op_name,
      u.region,
      u.country,
      u.language,
      u.op_project_slug,
      proj.name AS op_project_name,
      COALESCE(
        (
          SELECT ARRAY_AGG(mc.country ORDER BY mc.country)
            FROM temp_manager_countries mc
           WHERE mc.user_id = u.id
        ),
        ARRAY[]::varchar[]
      ) AS manager_countries,
      COALESCE(
        (
          SELECT ARRAY_AGG(oc.country ORDER BY oc.country)
            FROM temp_op_countries oc
           WHERE oc.user_id = u.id
        ),
        ARRAY[]::varchar[]
      ) AS op_countries,
      (
        -- Project of each OP country (column from migration 0029; read via
        -- to_jsonb so the list still works before that migration).
        SELECT json_agg(
                 json_build_object(
                   'slug', COALESCE(NULLIF(TRIM(to_jsonb(oc) ->> 'project_slug'), ''), u.op_project_slug),
                   'country', oc.country
                 )
                 ORDER BY oc.country
               )
          FROM temp_op_countries oc
         WHERE oc.user_id = u.id
      ) AS op_access,
      u.current_level,
      u.is_shared,
      (u.target_x_count + u.target_facebook_personal_count + u.target_facebook_umbrella_count
        + u.target_instagram_count + u.target_tiktok_count)::int AS target_accounts_sum,
      COALESCE(acc.account_count, 0)::int AS account_count,
      COALESCE(acc.plan_account_count, 0)::int AS plan_account_count
    FROM temp_users u
    LEFT JOIN (
      SELECT user_id,
             count(*) AS account_count,
             count(*) FILTER (WHERE is_spare = FALSE) AS plan_account_count
        FROM temp_social_media_accounts
       GROUP BY user_id
    ) acc ON acc.user_id = u.id AND u.role IN ('employee', 'team_lead')
    LEFT JOIN temp_users tl ON tl.id = u.team_lead_id
    LEFT JOIN temp_users mgr ON mgr.id = u.manager_id
    LEFT JOIN temp_users tlm ON tlm.id = tl.manager_id
    LEFT JOIN temp_users op_u ON op_u.id = u.op_id
    LEFT JOIN strategy_projects proj ON proj.slug = u.op_project_slug
    WHERE ${where.join(" AND ")}
    ORDER BY u.full_name ASC
  `;

  const [rows, alphaaRows] = await Promise.all([
    query<{
      id: number;
      full_name: string;
      email: string;
      role: AdminEmployeeListRow["role"];
      is_active: boolean;
      employee_code: string | null;
      employment_status: AdminEmployeeListRow["employment_status"];
      team_lead_id: number | null;
      team_lead_name: string | null;
      manager_id: number | null;
      manager_name: string | null;
      op_id: number | null;
      op_name: string | null;
      region: string | null;
      country: string | null;
      language: string | null;
      op_project_slug: string | null;
      op_project_name: string | null;
      manager_countries: string[] | null;
      op_countries: string[] | null;
      op_access: { slug: string | null; country: string }[] | null;
      current_level: number;
      is_shared: boolean;
      target_accounts_sum: number;
      account_count: number;
      plan_account_count: number;
    }>(sql, params),
    fetchAlphaaEmployeesList(filters),
  ]);
  const projectOptions = rows.some((r) => r.role === "op")
    ? await fetchEmployeeCreateProjectOptions()
    : [];

  const tempRows = rows.map((r) => {
    const country = r.country?.trim() || null;
    const region = r.region?.trim() || null;
    const managerCountries = r.manager_countries ?? [];
    // Operation Managers: countries per project (main project first).
    const opGroups = new Map<string, string[]>();
    if (r.role === "op") {
      const main = r.op_project_slug?.trim() ?? "";
      if (main) opGroups.set(main, []);
      for (const item of r.op_access ?? []) {
        const slug = item.slug?.trim() ?? "";
        if (!slug) continue;
        const list = opGroups.get(slug) ?? [];
        if (!list.includes(item.country)) list.push(item.country);
        opGroups.set(slug, list);
      }
    }
    const opCountryGroups = [...opGroups.entries()]
      .filter(([, list]) => list.length > 0)
      .map(([slug, list]) => {
        const option = projectOptions.find((item) => item.slug === slug);
        return {
          project: option?.name ?? slug,
          countries: mapEmployeeListCountries(list, {
            source: "temp",
            region: option?.region ?? region,
          }),
        };
      });
    const opCountries = [...new Set(r.op_countries ?? [])];
    const rawCountries =
      r.role === "manager" && managerCountries.length > 0
        ? managerCountries
        : r.role === "op" && opCountries.length > 0
          ? opCountries
          : country
            ? [country]
            : [];
    const countries = mapEmployeeListCountries(rawCountries, {
      source: "temp",
      region,
    });
    const project =
      r.role === "op"
        ? opCountryGroups[0]?.project ||
          r.op_project_name?.trim() ||
          r.op_project_slug?.trim() ||
          null
        : region
          ? regionDisplayLabel(region)
          : null;
    return {
      id: r.id,
      source: "temp" as const,
      full_name: r.full_name,
      email: r.email,
      role: r.role,
      is_active: r.is_active,
      employee_code: r.employee_code,
      employment_status: r.employment_status,
      team_lead_id: r.team_lead_id,
      team_lead_name: r.team_lead_name,
      manager_id: r.manager_id,
      manager_name: r.manager_name,
      op_id: r.op_id,
      op_name: r.op_name,
      region,
      project,
      projects:
        opCountryGroups.length > 1
          ? opCountryGroups.map((group) => group.project)
          : undefined,
      country: countries[0] ?? country,
      language: r.language,
      countries,
      countryGroups: opCountryGroups.length > 1 ? opCountryGroups : undefined,
      current_level: r.current_level,
      is_shared: r.is_shared === true,
      target_accounts_sum: r.target_accounts_sum,
      account_count: r.account_count,
      plan_account_count: r.plan_account_count,
    };
  });

  const expanded = await expandSharedEmployeeRows(tempRows, { region, country });
  return [...expanded, ...alphaaRows].sort(
    (a, b) => a.full_name.localeCompare(b.full_name) || a.id - b.id
  );
}

/**
 * Shared employees get one row per place they work (home + extra places), each
 * with that place's project, country and account counts. With a region or
 * country filter, only the matching places stay.
 */
async function expandSharedEmployeeRows(
  rows: AdminEmployeeListRow[],
  filters: { region?: string; country: string }
): Promise<AdminEmployeeListRow[]> {
  const sharedIds = rows.filter((row) => row.is_shared).map((row) => row.id);
  if (sharedIds.length === 0) return rows;

  const [places, accounts] = await Promise.all([
    fetchSharedPlaceOptions(sharedIds),
    query<{
      user_id: number;
      is_spare: boolean;
      assigned_region: string | null;
      assigned_country: string | null;
    }>(
      `SELECT user_id, is_spare, assigned_region, assigned_country
         FROM temp_social_media_accounts
        WHERE user_id = ANY($1::int[])`,
      [sharedIds]
    ),
  ]);

  const regionKey = filters.region?.trim().toLowerCase() ?? "";
  const regionMatches = (value: string) => {
    if (!regionKey) return true;
    const v = value.trim().toLowerCase();
    if (regionKey === "europe") return v === "europe" || v === "balkan";
    return v === regionKey;
  };
  const countryMatches = (value: string) =>
    !filters.country || value.trim().toLowerCase() === filters.country.trim().toLowerCase();

  const out: AdminEmployeeListRow[] = [];
  for (const row of rows) {
    const options = row.is_shared ? places.get(row.id) : undefined;
    if (!options || options.length < 2) {
      out.push(row);
      continue;
    }
    const home = options.find((option) => option.isHome) ?? options[0]!;
    for (const place of options) {
      // Home place of an Operation Manager / Country Manager: the role's own
      // countries (e.g. all 12 Asia countries), not just the home country.
      const roleCountries =
        place.isHome && (row.role === "op" || row.role === "manager") && row.countries.length > 0;
      const placeCountryMatches = roleCountries
        ? row.countries.some((label) => countryMatches(baseCountryFromDisplay(label)))
        : countryMatches(place.country);
      if (!regionMatches(place.region) || !placeCountryMatches) continue;
      const mine = accounts.filter(
        (account) =>
          account.user_id === row.id &&
          sharedPlaceKey({
            region: account.assigned_region?.trim() || home.region,
            country: account.assigned_country?.trim() || home.country,
          }) === place.key
      );
      const countries = mapEmployeeListCountries([place.country], {
        source: "temp",
        region: place.region,
      });
      out.push({
        ...row,
        region: place.region,
        project: roleCountries ? row.project : regionDisplayLabel(place.region) || row.project,
        ...(roleCountries
          ? {}
          : { country: countries[0] ?? place.country, countries, countryGroups: undefined }),
        place_key: place.key,
        account_count: mine.length,
        plan_account_count: mine.filter((account) => !account.is_spare).length,
      });
    }
  }
  return out;
}

export async function fetchTeamLeadOptions(): Promise<
  { id: number; full_name: string; manager_id: number | null }[]
> {
  return query(
    `SELECT id, full_name, manager_id
       FROM temp_users
      WHERE role = 'team_lead' AND is_active = TRUE
      ORDER BY full_name`
  );
}

export async function fetchOpOptions(): Promise<
  { id: number; full_name: string }[]
> {
  return query(
    `SELECT id, full_name
       FROM temp_users
      WHERE role = 'op' AND is_active = TRUE
      ORDER BY full_name`
  );
}

export async function fetchAdminSupervisorOptions(): Promise<
  { id: number; full_name: string }[]
> {
  return query(
    `SELECT id, full_name
       FROM temp_users
      WHERE role IN ('admin', 'hoo') AND is_active = TRUE
      ORDER BY full_name`
  );
}

/** Every project an OP can access, with its countries (first = main project). */
export async function fetchOpProjectsForUser(
  userId: number
): Promise<OpProjectAccessInput[]> {
  const { fetchOpAccessScope } = await import("@/lib/op-scope");
  const scope = await fetchOpAccessScope(userId);
  return (scope?.projects ?? []).map((project) => ({
    project_slug: project.projectSlug,
    countries: project.countries,
  }));
}

export async function fetchOpCountriesForUser(
  userId: number
): Promise<string[]> {
  const rows = await query<{ country: string }>(
    `SELECT country
       FROM temp_op_countries
      WHERE user_id = $1
      ORDER BY country`,
    [userId]
  );
  return rows.map((row) => row.country);
}

export async function fetchManagerCountriesForUser(
  userId: number
): Promise<string[]> {
  const rows = await query<{ country: string }>(
    `SELECT country FROM temp_manager_countries WHERE user_id = $1 ORDER BY country ASC`,
    [userId]
  );
  return rows.map((r) => r.country);
}

export type PlatformAccountCount = {
  platform: string;
  cnt: number;
};

export async function fetchActiveAccountCountsByPlatform(
  userId: number
): Promise<Record<string, number>> {
  const rows = await query<PlatformAccountCount>(
    `SELECT platform::text, COUNT(*)::int AS cnt
       FROM temp_social_media_accounts
      WHERE user_id = $1 AND status = 'active'
      GROUP BY platform`,
    [userId]
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.platform] = r.cnt;
  return out;
}

export async function fetchEmployeeActivityTimeline(
  userId: number
): Promise<EmployeeActivityItem[]> {
  return query(
    `SELECT * FROM (
       SELECT
         'submission'::text AS kind,
         g.submitted_at::text AS created_at,
         ('Submission: ' || a.account_name)::text AS description
         FROM temp_growth g
         JOIN temp_social_media_accounts a ON a.id = g.social_media_account_id
        WHERE g.user_id = $1 AND g.submitted_at IS NOT NULL
       UNION ALL
       SELECT
         'qc',
         g.qc_reviewed_at::text,
         (CASE g.qc_status
            WHEN 'approved' THEN 'Approved: '
            WHEN 'rejected_with_deduction' THEN 'Rejected (deduction): '
            WHEN 'rejected_no_deduction' THEN 'Rejected: '
            ELSE 'QC update: '
          END || a.account_name)::text
         FROM temp_growth g
         JOIN temp_social_media_accounts a ON a.id = g.social_media_account_id
        WHERE g.user_id = $1 AND g.qc_reviewed_at IS NOT NULL
     ) q
     WHERE q.created_at IS NOT NULL
     ORDER BY q.created_at DESC
     LIMIT 80`,
    [userId]
  );
}

export async function fetchAdminEmployeeEditorBundle(
  userId: number,
  source: AdminEmployeeSource = "temp"
): Promise<AdminEmployeeEditorBundle | null> {
  if (source === "alphaa") {
    return fetchAlphaaEmployeeEditorBundle(userId);
  }

  const user = await queryOne<TempUser>(
    `SELECT * FROM temp_users WHERE id = $1`,
    [userId]
  );
  if (!user) return null;

  const [
    teamLeads,
    managers,
    ops,
    admins,
    managerCountries,
    opProjects,
    projects,
    activeCounts,
  ] = await Promise.all([
    fetchTeamLeadOptions(),
    fetchManagerOptions(),
    fetchOpOptions(),
    fetchAdminSupervisorOptions(),
    user.role === "manager"
      ? fetchManagerCountriesForUser(userId)
      : Promise.resolve([] as string[]),
    user.role === "op"
      ? fetchOpProjectsForUser(userId)
      : Promise.resolve([] as OpProjectAccessInput[]),
    fetchEmployeeCreateProjectOptions(),
    fetchActiveAccountCountsByPlatform(userId),
  ]);
  const shared =
    user.role === "employee"
      ? await fetchEmployeeSharedSettings(userId)
      : { is_shared: false, extra_places: [] };

  const profile: EmployeeFormInitial = {
    ...shared,
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_active: user.is_active,
    employee_code: user.employee_code,
    employment_status: user.employment_status ?? "active",
    hire_date: normalizePgDateColumn(user.hire_date) ?? "",
    team_lead_id: user.team_lead_id,
    manager_id: user.manager_id,
    op_id: user.op_id ?? null,
    manager_countries: managerCountries,
    op_project_slug: user.op_project_slug ?? "",
    op_countries: opProjects.flatMap((project) => project.countries),
    op_projects: opProjects,
    current_level: user.current_level,
    country: user.country ?? "",
    region: user.region ?? "",
    updated_at:
      typeof user.updated_at === "string"
        ? user.updated_at
        : String(user.updated_at),
  };

  return {
    source: "temp",
    projectLabel: adminEmployeeProjectLabel("temp", user.country, user.region),
    fetchedAt: new Date().toISOString(),
    fullName: user.full_name,
    role: user.role,
    profile,
    teamLeads,
    managers,
    ops,
    admins,
    projects,
    targets: {
      target_x_count: user.target_x_count,
      target_facebook_personal_count: user.target_facebook_personal_count,
      target_facebook_umbrella_count: user.target_facebook_umbrella_count,
      target_instagram_count: user.target_instagram_count,
      target_tiktok_count: user.target_tiktok_count,
    },
    activeCounts,
  };
}

export async function fetchAdminCommandPalettePeople(): Promise<
  CommandPalettePerson[]
> {
  const [rows, accounts] = await Promise.all([
    fetchAdminEmployeesList({}),
    // Only the fields search matches on.
    query<CommandPaletteAccountRow & { user_id: number }>(
      `SELECT user_id, account_name, username, account_handle, account_url, platform
         FROM temp_social_media_accounts
        ORDER BY platform ASC, id ASC`
    ),
  ]);
  const accountsByUser = new Map<number, CommandPaletteAccountRow[]>();
  for (const account of accounts) {
    const list = accountsByUser.get(account.user_id) ?? [];
    list.push(account);
    accountsByUser.set(account.user_id, list);
  }
  return commandPalettePeopleFromRows(rows, accountsByUser);
}

