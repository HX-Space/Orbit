import { query } from "@/lib/db";
import { ALPHAA_REGION_WHERE } from "@/lib/alphaa-platform-sql";
import { capEuropeAccountsToCountryPlan } from "@/lib/balkan-sheets-plan-cap";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { splitAccountsBySheetsTab } from "@/lib/sheets-export-region";
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
    INNER JOIN temp_users u ON sma.user_id = u.id
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
 * join their parent tab. Only the Europe tab is capped to the country plan.
 */
export async function fetchAccountsForSheetsExport(): Promise<{
  Africa: SheetsExportAccountRow[];
  Europe: SheetsExportAccountRow[];
  Asia: SheetsExportAccountRow[];
  "Africa 2": SheetsExportAccountRow[];
  "Europe 2": SheetsExportAccountRow[];
  skipped: number;
}> {
  const [rows, projects] = await Promise.all([
    query<SheetsExportQueryRow>(`${SHEETS_EXPORT_QUERY}${SHEETS_EXPORT_ORDER}`),
    fetchEmployeeCreateProjectOptions(),
  ]);
  const tabs = splitAccountsBySheetsTab(rows, projects);
  const europe = await capEuropeAccountsToCountryPlan(tabs.Europe);
  return {
    Africa: tabs.Africa.map(mapSheetsExportRow),
    Europe: europe.map(mapSheetsExportRow),
    Asia: tabs.Asia.map(mapSheetsExportRow),
    "Africa 2": tabs["Africa 2"].map(mapSheetsExportRow),
    "Europe 2": tabs["Europe 2"].map(mapSheetsExportRow),
    skipped: tabs.skipped.length,
  };
}
