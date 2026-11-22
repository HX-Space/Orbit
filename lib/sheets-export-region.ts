import { setupCountriesForRegion, type SetupProjectCountries } from "@/lib/setup-options";

/** Strategy-layout tabs (S/N … Details). Main (ALPHAA) has its own export. */
export type SheetsExportTab = "Africa" | "Europe" | "Asia" | "Africa 2" | "Europe 2";

/** Kept for callers that still pass a region name; Main is "Alphaa". */
export type SheetsExportRegion = SheetsExportTab | "Alphaa";

/** Every strategy tab the sync writes, each holding only its own project. */
export const SHEETS_EXPORT_TABS: readonly SheetsExportTab[] = [
  "Africa",
  "Europe",
  "Asia",
  "Africa 2",
  "Europe 2",
];

/** Base tabs a new Strategy project is matched to by its countries. */
const BASE_TABS = ["Africa", "Europe", "Asia"] as const;

/** Region column value: Africa 2 rows still say "Africa", Europe 2 rows "Europe". */
export function sheetsBaseRegion(tab: SheetsExportTab): "Africa" | "Europe" | "Asia" {
  if (tab === "Africa 2") return "Africa";
  if (tab === "Europe 2") return "Europe";
  return tab;
}

const TAB_BY_PROJECT: Record<string, SheetsExportTab> = {
  africa: "Africa",
  europe: "Europe",
  balkan: "Europe",
  asia: "Asia",
  "africa 2": "Africa 2",
  "europe 2": "Europe 2",
};

/**
 * The tab a holder's project writes to, decided by the project, never by the
 * country (Sudan is in Africa and Main, Palestine in Main and Asia).
 * Africa 2 and Europe 2 have their own tabs. Any other project created in
 * Strategy goes to the base tab whose countries it shares most. Main (Alphaa) and unknown projects: null.
 */
export function sheetsTabForProject(
  region: string | null | undefined,
  projects: readonly SetupProjectCountries[]
): SheetsExportTab | null {
  const key = region?.trim().toLowerCase() ?? "";
  if (TAB_BY_PROJECT[key]) return TAB_BY_PROJECT[key];
  if (!key || key === "alphaa" || key === "main") return null;

  const project = projects.find((item) => item.region.trim().toLowerCase() === key);
  if (!project) return null;
  let best: SheetsExportTab | null = null;
  let bestShared = 0;
  for (const tab of BASE_TABS) {
    const countries = setupCountriesForRegion(tab) as readonly string[];
    const shared = project.countries.filter((country) => countries.includes(country)).length;
    if (shared > bestShared) {
      best = tab;
      bestShared = shared;
    }
  }
  return best;
}

/** Group accounts by tab. Accounts whose project has no tab are returned as skipped. */
export function splitAccountsBySheetsTab<T extends { region: string | null }>(
  accounts: T[],
  projects: readonly SetupProjectCountries[]
) {
  const byTab = Object.fromEntries(
    SHEETS_EXPORT_TABS.map((tab) => [tab, [] as T[]])
  ) as Record<SheetsExportTab, T[]>;
  const skipped: T[] = [];
  const tabFor = new Map<string, SheetsExportTab | null>();
  for (const account of accounts) {
    const key = account.region?.trim() ?? "";
    if (!tabFor.has(key)) tabFor.set(key, sheetsTabForProject(key, projects));
    const tab = tabFor.get(key);
    if (tab) byTab[tab].push(account);
    else skipped.push(account);
  }
  return { ...byTab, skipped };
}
