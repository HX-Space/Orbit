import type { EmployeeCreateProjectOption } from "@/types/admin";

/** Built-in projects keep their historic temp_users.region values. */
const KNOWN_REGIONS: Record<string, string> = {
  alphaa: "Alphaa",
  africa: "Africa",
  europe: "Europe",
  asia: "Asia",
};

/** temp_users.region for a Strategy project: built-in value, else the project name. */
export function projectRegionValue(slug: string, name: string): string {
  return KNOWN_REGIONS[slug.trim().toLowerCase()] ?? name.trim();
}

/**
 * Map a Strategy project slug to the `temp_users.region` value. Pass the project
 * list for projects created in Strategy (their region is the project name).
 */
export function regionFromStrategyProjectSlug(
  slug: string,
  projects?: Pick<EmployeeCreateProjectOption, "slug" | "region">[]
): string {
  const normalized = slug.trim().toLowerCase();
  const known = KNOWN_REGIONS[normalized];
  if (known) return known;
  return projects?.find((project) => project.slug === normalized)?.region ?? "";
}

export function countriesForCreateProject(
  projects: EmployeeCreateProjectOption[],
  projectSlug: string
): string[] {
  return projects.find((project) => project.slug === projectSlug)?.countries ?? [];
}

export function projectNameForSlug(
  projects: EmployeeCreateProjectOption[],
  projectSlug: string
): string {
  return projects.find((project) => project.slug === projectSlug)?.name ?? projectSlug;
}
