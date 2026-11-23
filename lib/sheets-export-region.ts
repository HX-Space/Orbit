import { setupCountriesForRegion, type SetupProjectCountries } from "@/lib/setup-options";

/** Strategy-layout tabs (S/N … Details). Main (ALPHAA) has its own export. */
export type SheetsExportTab = "Africa" | "Europe" | "Asia";

/** Kept for callers that still pass a region name; Main is "Alphaa". */
export type SheetsExportRegion = SheetsExportTab | "Alphaa";

const SHEETS_TABS: readonly SheetsExportTab[] = ["Africa", "Europe", "Asia"];

const TAB_BY_PROJECT: Record<string, SheetsExportTab> = {
  africa: "Africa",
  europe: "Europe",
  balkan: "Europe",
  asia: "Asia",
  // Kept as separate projects in Orbit, but written into the same sheet tab.
  "africa 2": "Africa",
  "europe 2": "Europe",
};

/**
 * The tab a holder's project writes to, decided by the project, never by the
 * country (Sudan is in Africa and Main, Palestine in Main and Asia).
 * A project created in Strategy (e.g. "Africa 2") goes to the tab whose
 * countries it shares most. Main (Alphaa) and unknown projects: null.
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
  for (const tab of SHEETS_TABS) {
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
  const byTab: Record<SheetsExportTab, T[]> = { Africa: [], Europe: [], Asia: [] };
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
