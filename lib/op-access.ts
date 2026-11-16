import type { OpProjectAccessInput } from "@/types/admin";

/** Add a project to an OP's access (no countries yet), or remove it. */
export function toggleOpProject(
  access: OpProjectAccessInput[],
  slug: string
): OpProjectAccessInput[] {
  return access.some((item) => item.project_slug === slug)
    ? access.filter((item) => item.project_slug !== slug)
    : [...access, { project_slug: slug, countries: [] }];
}

/** Tick or untick one country inside one of the OP's projects. */
export function toggleOpProjectCountry(
  access: OpProjectAccessInput[],
  slug: string,
  country: string
): OpProjectAccessInput[] {
  return access.map((item) =>
    item.project_slug !== slug
      ? item
      : {
          ...item,
          countries: item.countries.includes(country)
            ? item.countries.filter((c) => c !== country)
            : [...item.countries, country],
        }
  );
}

/** Projects with at least one country, in the order they were picked. */
export function opAccessToSave(access: OpProjectAccessInput[]): OpProjectAccessInput[] {
  return access.filter((item) => item.project_slug && item.countries.length > 0);
}

/** A picked project with no country ticked yet (the save is blocked). */
export function opAccessEmptyProject(access: OpProjectAccessInput[]) {
  return access.find((item) => item.countries.length === 0) ?? null;
}
