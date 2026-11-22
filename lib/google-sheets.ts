import { google } from "googleapis";
import {
  ALPHAA_SHEETS_EXPORT_HEADERS,
  alphaaSheetsExportValuesFromRow,
  transformAlphaaSheetsExportRow,
} from "@/lib/alphaa-sheets-export-transform";
import {
  sheetsExportValuesFromRow,
  transformSheetsExportRow,
} from "@/lib/sheets-export-transform";
import type { SheetsExportTab } from "@/lib/sheets-export-region";
import type { SetupRegion } from "@/lib/setup-options";
import type {
  AlphaaSheetsExportAccountRow,
  SheetsExportAccountRow,
} from "@/types/admin";

/** Africa/Europe/Asia — row 1 keeps template headers; data starts at row 2. */
const STRATEGY_DATA_START_ROW = 2;
const STRATEGY_MAX_DATA_ROW = 5000;

type RegionSheetsTarget = {
  spreadsheetId: string;
  sheetTab: string;
};

type GoogleSheetsCredentials = {
  clientEmail: string;
  privateKey: string;
};

function getGoogleSheetsCredentials(): GoogleSheetsCredentials {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY."
    );
  }

  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, "\n"),
  };
}

function getRegionSheetsTarget(region: SetupRegion): RegionSheetsTarget {
  const spreadsheetId = process.env.SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    throw new Error(
      "Google Sheets is not configured. Set SPREADSHEET_ID."
    );
  }

  let sheetTab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Africa";
  if (region === "Europe") {
    sheetTab =
      process.env.GOOGLE_SHEETS_TAB_EUROPE?.trim() ||
      process.env.GOOGLE_SHEETS_TAB_BALKAN?.trim() ||
      "Europe";
  } else if (region === "Alphaa") {
    sheetTab = process.env.GOOGLE_SHEETS_TAB_ALPHAA?.trim() || "ALPHAA";
  } else if (region === "Asia") {
    sheetTab = process.env.GOOGLE_SHEETS_TAB_ASIA?.trim() || "Asia";
  } else if (region === "Africa 2") {
    sheetTab = process.env.GOOGLE_SHEETS_TAB_AFRICA_2?.trim() || "Africa 2";
  } else if (region === "Europe 2") {
    sheetTab = process.env.GOOGLE_SHEETS_TAB_EUROPE_2?.trim() || "Europe 2";
  }

  return { spreadsheetId, sheetTab };
}

function getSheetsClient(credentials: GoogleSheetsCredentials) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

/** Africa/Europe/Asia strategy tabs — data only (headers live on the sheet template). */
async function syncStrategyAccountsToSheetTab(
  tab: SheetsExportTab,
  target: RegionSheetsTarget,
  accounts: SheetsExportAccountRow[],
  credentials: GoogleSheetsCredentials
) {
  const sheets = getSheetsClient(credentials);
  const transformedAccounts = accounts.map((account) =>
    transformSheetsExportRow(account, tab)
  );
  const values = transformedAccounts.map((account, index) =>
    sheetsExportValuesFromRow(account, index + 1)
  );

  const clearRange = `${target.sheetTab}!A${STRATEGY_DATA_START_ROW}:W${STRATEGY_MAX_DATA_ROW}`;
  const updateRange = `${target.sheetTab}!A${STRATEGY_DATA_START_ROW}`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: target.spreadsheetId,
    range: clearRange,
  });

  if (values.length === 0) {
    return 0;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: target.spreadsheetId,
    range: updateRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  return accounts.length;
}

/** ALPHAA tab — full replace including headers (original ALPHAA sheet format). */
async function syncAlphaaAccountsToSheetTab(
  target: RegionSheetsTarget,
  accounts: AlphaaSheetsExportAccountRow[],
  credentials: GoogleSheetsCredentials
) {
  // Main accounts are read from temp tables now. Until they are copied over the
  // list is empty — leave the existing ALPHAA tab untouched instead of clearing it.
  if (accounts.length === 0) return 0;

  const sheets = getSheetsClient(credentials);
  const transformedAccounts = accounts.map(transformAlphaaSheetsExportRow);
  const values = transformedAccounts.map(alphaaSheetsExportValuesFromRow);

  const clearRange = `${target.sheetTab}!A1:Z`;
  const updateRange = `${target.sheetTab}!A1`;

  await sheets.spreadsheets.values.clear({
    spreadsheetId: target.spreadsheetId,
    range: clearRange,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: target.spreadsheetId,
    range: updateRange,
    valueInputOption: "RAW",
    requestBody: {
      values: [Array.from(ALPHAA_SHEETS_EXPORT_HEADERS), ...values],
    },
  });

  return accounts.length;
}

export type SheetsSyncSummary = {
  africaCount: number;
  europeCount: number;
  /** @deprecated Use europeCount */
  balkanCount: number;
  asiaCount: number;
  africa2Count: number;
  europe2Count: number;
  alphaaCount: number;
  total: number;
};

/** Say which tab failed (e.g. the Asia tab hasn't been created yet). */
async function withTabName<T>(tabName: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`"${tabName}" tab: ${message}`);
  }
}

/** Sync the Africa, Europe, Asia, Africa 2, Europe 2 and Main (ALPHAA) tabs, each with its own project's accounts. */
export async function syncAccountsToGoogleSheets(
  projectAccounts: Record<SheetsExportTab, SheetsExportAccountRow[]>,
  alphaaAccounts: AlphaaSheetsExportAccountRow[]
): Promise<SheetsSyncSummary> {
  const credentials = getGoogleSheetsCredentials();
  const syncTab = (tab: SheetsExportTab) => {
    const target = getRegionSheetsTarget(tab);
    return withTabName(target.sheetTab, () =>
      syncStrategyAccountsToSheetTab(tab, target, projectAccounts[tab], credentials)
    );
  };
  const alphaaTarget = getRegionSheetsTarget("Alphaa");

  const [africaCount, europeCount, asiaCount, africa2Count, europe2Count, alphaaCount] =
    await Promise.all([
      syncTab("Africa"),
      syncTab("Europe"),
      syncTab("Asia"),
      syncTab("Africa 2"),
      syncTab("Europe 2"),
      withTabName(alphaaTarget.sheetTab, () =>
        syncAlphaaAccountsToSheetTab(alphaaTarget, alphaaAccounts, credentials)
      ),
    ]);

  return {
    africaCount,
    europeCount,
    balkanCount: europeCount,
    asiaCount,
    africa2Count,
    europe2Count,
    alphaaCount,
    total:
      africaCount + europeCount + asiaCount + africa2Count + europe2Count + alphaaCount,
  };
}
