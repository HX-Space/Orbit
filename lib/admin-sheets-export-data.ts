import { TEMP_USER_SLICES, accountInSliceSql } from "@/lib/shared-employee-sql";
import { query } from "@/lib/db";
import { ALPHAA_REGION_WHERE } from "@/lib/alphaa-platform-sql";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { splitAccountsBySheetsTab } from "@/lib/sheets-export-region";
import { sheetCountryName } from "@/lib/sheets-country-config";
import type { Platform } from "@/lib/platform-config";
import type { AccountScope } from "@/types/db";
import type { SheetsExportAccountRow } from "@/types/admin";

type SheetsExportQueryRow = {
  user_id: number;
  region: string | null;
  country: string | null;
  language: string | null;
  handler_name: string;
  platform: Platform;
  account_name: string;
  account_handle: string | null;
  account_url: string | null;
  category: string | null;
  account_scope: AccountScope;
  username: string | null;
  account_email: string | null;
  account_password: string | null;
  mobile_number: string | null;
  status: SheetsExportAccountRow["status"];
};

function mapSheetsExportRow(row: SheetsExportQueryRow): SheetsExportAccountRow {
  return {
    region: row.region,
    country: row.country,
    language: row.language,
    handler_name: row.handler_name,
    platform: row.platform,
    account_name: row.account_name,
    account_handle: row.account_handle,
    account_url: row.account_url,
    category: row.category,
    account_scope: row.account_scope,
    username: row.username,
    account_email: row.account_email,
    account_password: row.account_password,
    mobile_number: row.mobile_number,
    status: row.status,
  };
}

const SHEETS_EXPORT_QUERY = `
  SELECT
      u.id AS user_id,
      u.region,
      u.country,
      u.language,
      u.full_name AS handler_name,
      sma.platform,
      sma.account_name,
      sma.account_handle,
      sma.account_url,
      sma.category,
      sma.account_scope,
      sma.username,
      sma.account_email,
      sma.account_password,
      sma.mobile_number,
      sma.status
    FROM temp_social_media_accounts sma
    INNER JOIN ${TEMP_USER_SLICES} u
      ON u.id = sma.user_id AND ${accountInSliceSql("sma", "u")}
    WHERE u.role = 'employee'
      AND u.is_active = TRUE
      AND sma.is_spare = FALSE
      -- Main (ALPHAA) holders go to the Main tab only (own export).
      AND NOT ${ALPHAA_REGION_WHERE}
`;

const SHEETS_EXPORT_ORDER = `
  ORDER BY u.country ASC NULLS LAST,
           u.full_name ASC,
           u.id ASC,
           CASE sma.platform
             WHEN 'facebook_personal' THEN 1
             WHEN 'facebook_umbrella' THEN 2
             WHEN 'x' THEN 3
             WHEN 'instagram' THEN 4
             WHEN 'tiktok' THEN 5
             ELSE 6
           END,
           sma.id ASC
`;

/**
 * Africa / Europe / Asia strategy export, one list per tab. Each account goes
 * to its holder's project tab (never by country); Strategy-created projects
 * join their parent tab. Every non-spare account is written; none are cut to the plan.
 */
export async function fetchAccountsForSheetsExport(): Promise<{
  Africa: SheetsExportAccountRow[];
  Europe: SheetsExportAccountRow[];
  Asia: SheetsExportAccountRow[];
  skipped: number;
}> {
  const [rows, projects] = await Promise.all([
    query<SheetsExportQueryRow>(`${SHEETS_EXPORT_QUERY}${SHEETS_EXPORT_ORDER}`),
    fetchEmployeeCreateProjectOptions(),
  ]);
  const tabs = splitAccountsBySheetsTab(rows, projects);
  return {
    Africa: groupInternalCountries(tabs.Africa).map(mapSheetsExportRow),
    Europe: groupInternalCountries(tabs.Europe).map(mapSheetsExportRow),
    Asia: groupInternalCountries(tabs.Asia).map(mapSheetsExportRow),
    skipped: tabs.skipped.length,
  };
}

/**
 * The sheet shows Orbit's internal "Moldova 2" as Moldova (sheetCountryName),
 * so its rows go right after Moldova's; every other row keeps its order.
 */
function groupInternalCountries<T extends { country: string | null }>(rows: T[]): T[] {
  const sheetName = (row: T) => sheetCountryName(row.country?.trim() ?? "");
  const moved = rows.filter((row) => sheetName(row) !== (row.country?.trim() ?? ""));
  if (moved.length === 0) return rows;
  const out = rows.filter((row) => !moved.includes(row));
  for (const row of moved) {
    const name = sheetName(row);
    let at = -1;
    out.forEach((item, index) => {
      if (sheetName(item) === name) at = index;
    });
    // After the real country's last row (or where it sorts, if it has none).
    if (at < 0) at = out.findIndex((item) => sheetName(item).localeCompare(name) > 0) - 1;
    out.splice(at < -1 ? out.length : at + 1, 0, row);
  }
  return out;
}
