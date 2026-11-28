import {
  isAlphaaCountry,
  isEuropeCountry,
  isTempPlanCountry,
  regionForCountry,
} from "@/lib/region-config";

export const SETUP_REGION = "Africa" as const;

/** Africa countries — labels must match Google Sheets dropdowns. */
export const SETUP_COUNTRIES = [
  "Congo",
  "Central African Republic",
  "Ghana",
  "Guinea",
  "Mauritius",
  "South Sudan",
  "Niger",
  "Djibouti",
  "Comoros",
  "Ivory Coast",
  "Gabon",
  "Uganda",
  "Libya",
  "Rwanda",
  "Mauritania",
  "Senegal",
  "Cameroon",
  "Somalia",
  "Borkina",
  "Angola",
  "Tanzania",
  "Mozambique",
  "Madagascar",
  "Zambia",
  "Nigeria",
  "Mali",
  "Chad",
  "Sudan",
  // Big countries kept apart after Africa 2 was merged into Africa.
  "Sudan 2",
] as const;

/** Europe (formerly Balkan) countries — labels must match Google Sheets dropdowns. */
export const EUROPE_SETUP_COUNTRIES = [
  "Slovakia",
  "Moldova",
  "Slovenia",
  "Macedonia",
  "Bulgaria",
  "Bosnia",
  // Big countries kept apart after Europe 2 was merged into Europe.
  "Moldova 2",
  "Slovakia 2",
] as const;

/** @deprecated Use EUROPE_SETUP_COUNTRIES */
export const BALKAN_SETUP_COUNTRIES = EUROPE_SETUP_COUNTRIES;

export const ALPHAA_SETUP_COUNTRIES = [
  "Sudan",
  "Somalia",
  "Palestine",
  "Turkey",
  "Iran",
] as const;

/** ALPHAA countries not already listed under Africa/Europe setup lists. */
export const ALPHAA_EXCLUSIVE_SETUP_COUNTRIES = [
  "Palestine",
  "Turkey",
  "Iran",
] as const;

/** Asia strategy countries. */
export const ASIA_SETUP_COUNTRIES = [
  "North Korea",
  "South Korea",
  "Japan",
  "Mongolia",
  "Azerbaijan",
  "Armenia",
  "Iraq",
  "Palestine",
  "Bahrain",
  "Kuwait",
  "Oman",
  "Georgia",
] as const;

/** Asia countries not already listed under Africa/Europe/ALPHAA setup lists. */
export const ASIA_EXCLUSIVE_SETUP_COUNTRIES = [
  "North Korea",
  "South Korea",
  "Japan",
  "Mongolia",
  "Azerbaijan",
  "Armenia",
  "Iraq",
  "Bahrain",
  "Kuwait",
  "Oman",
  "Georgia",
] as const;

export const ALL_SETUP_COUNTRIES = [
  ...SETUP_COUNTRIES,
  ...EUROPE_SETUP_COUNTRIES,
  ...ALPHAA_EXCLUSIVE_SETUP_COUNTRIES,
  ...ASIA_EXCLUSIVE_SETUP_COUNTRIES,
] as const;

export const SETUP_CATEGORIES = ["GH-G", "GH-R"] as const;

/** App language dropdown values (Africa / Europe / Main / Asia). */
export const SETUP_LANGUAGES = [
  "French",
  "Sango",
  "Creole (Kriol)",
  "Twi",
  "Mauritian Creole",
  "English",
  "Kriol",
  "Lingala",
  "Olyad",
  "Malagasy",
  "Arabic",
  "Somali",
  "Portuguese",
  "Kiswahili",
  "Slovak",
  "Romanian",
  "Russian",
  "Slovenian",
  "Macdonian",
  "Albanian",
  "Bulgarian",
  "Bosnian",
  "Serbian",
  "Croatian",
  "Turkish",
  "Persian",
  "Korean",
  "Japanese",
  "Mongolian",
  "Azerbaijani",
  "Armenian",
  "Georgian",
  // Latin America (US project: Cuba, Guatemala, Peru, Chile, …).
  "Spanish",
] as const;

export function isSetupCountry(value: string) {
  return (ALL_SETUP_COUNTRIES as readonly string[]).includes(value);
}

export function setupRegionForCountry(country: string) {
  return regionForCountry(country) ?? SETUP_REGION;
}

/** Built-in project keys, or the name of a project created in Strategy. */
export type SetupRegion = "Africa" | "Europe" | "Alphaa" | "Asia" | (string & {});

export const BUILT_IN_SETUP_REGIONS = ["Africa", "Europe", "Alphaa", "Asia"] as const;

export function isBuiltInSetupRegion(region: string): boolean {
  return (BUILT_IN_SETUP_REGIONS as readonly string[]).includes(region);
}

/** A Strategy project's people value (temp_users.region) and its countries. */
export type SetupProjectCountries = { region: string; countries: readonly string[] };

/**
 * Countries of a project. Built-in projects use the setup lists; projects
 * created in Strategy use their own countries (pass `projects`).
 */
export function setupCountriesForRegion(
  region: SetupRegion,
  projects?: readonly SetupProjectCountries[]
): readonly string[] {
  if (region === "Europe") return EUROPE_SETUP_COUNTRIES;
  if (region === "Alphaa") return ALPHAA_SETUP_COUNTRIES;
  if (region === "Asia") return ASIA_SETUP_COUNTRIES;
  if (region === "Africa") return SETUP_COUNTRIES;
  const custom = projects?.find((project) => project.region === region);
  return custom ? custom.countries : SETUP_COUNTRIES;
}

/** Every project (region) whose country list contains this country. */
export function setupRegionsForCountry(
  country: string,
  projects?: readonly SetupProjectCountries[]
): SetupRegion[] {
  const builtIn: SetupRegion[] = BUILT_IN_SETUP_REGIONS.filter((region) =>
    (setupCountriesForRegion(region) as readonly string[]).includes(country)
  );
  const custom = (projects ?? [])
    .filter(
      (project) =>
        !isBuiltInSetupRegion(project.region) &&
        project.countries.includes(country)
    )
    .map((project) => project.region);
  return [...builtIn, ...custom];
}

/**
 * Country Manager tick/untick. A manager has one project, so ticking a country that
 * is in two projects (Sudan: Africa + Main) in one group sets the manager's project.
 */
export function toggleManagerCountryInGroup(
  countries: string[],
  region: string,
  option: string,
  groupRegion: string,
  projects?: readonly SetupProjectCountries[]
): { countries: string[]; region: string } {
  const shared = setupRegionsForCountry(option, projects).length > 1;
  const has = countries.includes(option);
  const checkedHere = has && (!shared || !region || region === groupRegion);
  if (checkedHere) {
    return { countries: countries.filter((c) => c !== option), region };
  }
  const nextRegion = has || shared || countries.length === 0 || !region ? groupRegion : region;
  const next = has ? countries : [...countries, option];
  if (nextRegion === region) return { countries: next, region };
  // Project changed: drop shared countries that are not in the new project (they would be hidden).
  return {
    countries: next.filter((c) => {
      const regions = setupRegionsForCountry(c, projects);
      return regions.length < 2 || regions.some((r) => r === nextRegion);
    }),
    region: nextRegion,
  };
}

/** A Strategy project as the Employees filters see it. */
export type SetupListProject = SetupProjectCountries & { slug: string; name: string };

export function employeeListRegionFromSlug(
  value: string | undefined,
  projects?: readonly SetupListProject[]
): "all" | SetupRegion {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "europe" || normalized === "balkan") return "Europe";
  if (normalized === "africa") return "Africa";
  if (normalized === "alphaa") return "Alphaa";
  if (normalized === "asia") return "Asia";
  const custom = projects?.find(
    (project) => project.slug === normalized && !isBuiltInSetupRegion(project.region)
  );
  return custom ? custom.region : "all";
}

export function employeeListRegionSlug(
  region: SetupRegion,
  projects?: readonly SetupListProject[]
): string {
  if (region === "Europe") return "europe";
  if (region === "Alphaa") return "alphaa";
  if (region === "Asia") return "asia";
  if (region === "Africa") return "africa";
  return projects?.find((project) => project.region === region)?.slug ?? "africa";
}

export function isCountryInEmployeeListRegion(
  country: string,
  region: "all" | SetupRegion,
  projects?: readonly SetupListProject[]
) {
  const inCustom = (projects ?? []).some(
    (project) =>
      !isBuiltInSetupRegion(project.region) &&
      (region === "all" || project.region === region) &&
      project.countries.includes(country)
  );
  if (region !== "all" && !isBuiltInSetupRegion(region)) return inCustom;
  if (!isSetupCountry(country)) return region === "all" && inCustom;
  if (region === "all") return true;
  return (setupCountriesForRegion(region) as readonly string[]).includes(country);
}

export { isAlphaaCountry, isEuropeCountry, isTempPlanCountry };
/** @deprecated Use isEuropeCountry */
export { isEuropeCountry as isBalkanCountry };

export function isSetupCategory(value: string) {
  return (SETUP_CATEGORIES as readonly string[]).includes(value);
}

export function isSetupLanguage(value: string) {
  return (SETUP_LANGUAGES as readonly string[]).includes(value);
}

export function isSetupProfileComplete(profile: {
  country: string | null | undefined;
  language: string | null | undefined;
}) {
  return (
    isSetupCountry(profile.country ?? "") &&
    isSetupLanguage(profile.language ?? "")
  );
}
