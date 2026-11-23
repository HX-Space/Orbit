import { TEMP_USER_SLICES, accountInSliceSql } from "@/lib/shared-employee-sql";
import { sharedPlaceKey, sharedPlaceLabel } from "@/lib/shared-places";
import { query } from "@/lib/db";
import {
  ALPHAA_LEGACY_COUNTRY,
  ALPHAA_REGION_WHERE,
} from "@/lib/alphaa-platform-sql";
import { overviewDisplayCountry } from "@/lib/overview-country-display";
import type { Platform } from "@/lib/platform-config";
import type { AccountScope } from "@/types/db";
import type { SharedPlaceOption,
  AdminEmployeeSource,
  AdminSocialAccountListItem,
  AdminSpareAccountListItem,
  SpareMarkHolderOption,
} from "@/types/admin";

type AccountQueryRow = {
  id: number;
  user_id: number;
  platform: Platform;
  account_name: string;
  account_handle: string | null;
  account_url: string | null;
  category: string | null;
  username: string | null;
  account_email: string | null;
  account_password: string | null;
  email_password: string | null;
  mobile_number: string | null;
  account_scope: AccountScope;
  status: AdminSocialAccountListItem["status"];
  is_spare: boolean;
  assigned_region: string | null;
  assigned_country: string | null;
};

type TempSpareQueryRow = Omit<AdminSpareAccountListItem, "source" | "projects">;

type AlphaaSpareQueryRow = {
  id: number;
  platform: string;
  username: string | null;
  account_name: string | null;
  account_url: string | null;
  category: string | null;
  status: AdminSpareAccountListItem["status"];
  handler_id: number;
  handler_name: string;
  country: string | null;
};

type TempSpareHolderRow = {
  id: number;
  full_name: string;
  country: string | null;
  region: string | null;
};

type AlphaaSpareHolderRow = {
  id: number;
  full_name: string;
  country: string | null;
};

function mapAccount(row: AccountQueryRow): AdminSocialAccountListItem {
  return {
    id: row.id,
    platform: row.platform,
    account_name: row.account_name,
    account_handle: row.account_handle,
    account_url: row.account_url,
    category: row.category,
    username: row.username,
    account_email: row.account_email,
    account_password: row.account_password,
    email_password: row.email_password,
    mobile_number: row.mobile_number,
    account_scope: row.account_scope,
    status: row.status,
    is_spare: row.is_spare,
  };
}

/** Home place first, then the extra places, for shared employees among userIds. */
export async function fetchSharedPlaceOptions(
  userIds: number[]
): Promise<Map<number, SharedPlaceOption[]>> {
  const byUser = new Map<number, SharedPlaceOption[]>();
  if (userIds.length === 0) return byUser;
  const rows = await query<{
    id: number;
    region: string | null;
    country: string | null;
    is_extra_slice: boolean;
  }>(
    `SELECT id, region, country, is_extra_slice
       FROM ${TEMP_USER_SLICES}
      WHERE id = ANY($1::int[])
        AND is_shared = TRUE
      ORDER BY id, is_extra_slice, region, country`,
    [userIds]
  );
  for (const row of rows) {
    const place = { region: row.region?.trim() ?? "", country: row.country?.trim() ?? "" };
    const list = byUser.get(row.id) ?? [];
    list.push({
      ...place,
      key: sharedPlaceKey(place),
      label: sharedPlaceLabel(place, !row.is_extra_slice),
      isHome: !row.is_extra_slice,
    });
    byUser.set(row.id, list);
  }
  return byUser;
}

export async function fetchAdminEmployeeAccounts(
  userId: number
): Promise<AdminSocialAccountListItem[]> {
  const byUser = await fetchAdminAccountsByUserIds([userId]);
  return byUser.get(userId) ?? [];
}

export async function fetchAdminAccountsByUserIds(
  userIds: number[]
): Promise<Map<number, AdminSocialAccountListItem[]>> {
  const byUser = new Map<number, AdminSocialAccountListItem[]>();
  if (userIds.length === 0) return byUser;

  const rows = await query<AccountQueryRow>(
    `SELECT id, user_id, platform, account_name, account_handle, account_url,
            category, username, account_email, account_password, email_password,
            mobile_number, account_scope, status, is_spare,
            assigned_region, assigned_country
       FROM temp_social_media_accounts
      WHERE user_id = ANY($1::int[])
      ORDER BY platform ASC, id ASC`,
    [userIds]
  );
  const placesByUser = await fetchSharedPlaceOptions(userIds);
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    const account = mapAccount(row);
    const options = placesByUser.get(row.user_id);
    if (options && options.length > 1) {
      const home = options.find((option) => option.isHome) ?? options[0]!;
      account.place = {
        key: sharedPlaceKey({
          region: row.assigned_region?.trim() || home.region,
          country: row.assigned_country?.trim() || home.country,
        }),
        options,
        canChange: false,
      };
    }
    list.push(account);
    byUser.set(row.user_id, list);
  }
  return byUser;
}

export async function fetchAdminHolderAccounts(
  userId: number,
  // Main (ALPHAA) holders live in temp tables too, so both sources read the same table.
  source: AdminEmployeeSource
): Promise<AdminSocialAccountListItem[]> {
  void source;
  return fetchAdminEmployeeAccounts(userId);
}

async function fetchTempSpareAccounts(): Promise<AdminSpareAccountListItem[]> {
  const rows = await query<TempSpareQueryRow>(
    `SELECT
        a.id,
        a.platform,
        a.username,
        a.account_name,
        a.account_url,
        a.category,
        a.status,
        u.id AS handler_id,
        u.full_name AS handler_name,
        u.country,
        u.region
       FROM temp_social_media_accounts a
       INNER JOIN ${TEMP_USER_SLICES} u
         ON u.id = a.user_id AND ${accountInSliceSql("a", "u")}
      WHERE a.is_spare = TRUE
        AND a.status = 'active'
        AND LOWER(u.role) = 'employee'
        AND u.is_active = TRUE
        -- Every project except Main (Africa, Europe, Asia and Strategy projects).
        AND LOWER(TRIM(COALESCE(u.region, ''))) NOT IN ('', 'alphaa', 'main')
      ORDER BY u.region ASC, u.country ASC, u.full_name ASC, a.platform ASC, a.id ASC`
  );
  return rows.map((row) => ({
    ...row,
    source: "temp" as const,
    projects: row.country ? [row.country] : [],
  }));
}

async function fetchAlphaaSpareAccounts(): Promise<AdminSpareAccountListItem[]> {
  const rows = await query<AlphaaSpareQueryRow>(
    `SELECT
        sma.id,
        sma.platform,
        sma.username,
        sma.account_name,
        sma.account_url,
        sma.category,
        sma.status,
        u.id AS handler_id,
        COALESCE(
          NULLIF(TRIM(u.full_name), ''),
          'Handler ' || u.id::text
        ) AS handler_name,
        ${ALPHAA_LEGACY_COUNTRY} AS country
       FROM temp_social_media_accounts sma
       INNER JOIN ${TEMP_USER_SLICES} u
         ON u.id = sma.user_id AND ${accountInSliceSql("sma", "u")}
      WHERE ${ALPHAA_REGION_WHERE}
        AND sma.is_spare IS TRUE
      ORDER BY country ASC, handler_name ASC, sma.platform ASC, sma.id ASC`
  );

  return rows.map((row) => {
    const country = row.country?.trim() || null;
    return {
      id: row.id,
      source: "alphaa" as const,
      platform: row.platform,
      username: row.username,
      account_name: row.account_name?.trim() || row.username?.trim() || "—",
      account_url: row.account_url,
      category: row.category,
      status: row.status,
      handler_id: row.handler_id,
      handler_name: row.handler_name,
      country: country ? overviewDisplayCountry(country, "Alphaa") : null,
      region: "Alphaa",
      projects: country ? [country] : [],
    };
  });
}

function compareSpareAccounts(
  left: AdminSpareAccountListItem,
  right: AdminSpareAccountListItem
) {
  return (
    (left.region ?? "").localeCompare(right.region ?? "") ||
    (left.country ?? "").localeCompare(right.country ?? "") ||
    left.handler_name.localeCompare(right.handler_name) ||
    left.platform.localeCompare(right.platform) ||
    left.id - right.id
  );
}

/** Active spare accounts for Africa, Europe, and ALPHAA handlers (admin modal). */
export async function fetchAdminSpareAccounts(): Promise<
  AdminSpareAccountListItem[]
> {
  const [temp, alphaa] = await Promise.all([
    fetchTempSpareAccounts(),
    fetchAlphaaSpareAccounts(),
  ]);
  return [...temp, ...alphaa].sort(compareSpareAccounts);
}

/** Handlers that can have an account marked or unmarked as spare. */
export async function fetchAdminSpareMarkHolders(): Promise<
  SpareMarkHolderOption[]
> {
  const [tempRows, alphaaRows] = await Promise.all([
    query<TempSpareHolderRow>(
      `SELECT u.id, u.full_name, u.country, u.region
         FROM temp_users u
        WHERE LOWER(u.role) = 'employee'
          AND u.is_active = TRUE
          -- Every project except Main (Africa, Europe, Asia and Strategy projects).
        AND LOWER(TRIM(COALESCE(u.region, ''))) NOT IN ('', 'alphaa', 'main')
          AND EXISTS (
            SELECT 1
              FROM temp_social_media_accounts a
             WHERE a.user_id = u.id
          )
        ORDER BY u.full_name ASC, u.id ASC`
    ),
    query<AlphaaSpareHolderRow>(
      `SELECT
          u.id,
          COALESCE(
            NULLIF(TRIM(u.full_name), ''),
            'Handler ' || u.id::text
          ) AS full_name,
          ${ALPHAA_LEGACY_COUNTRY} AS country
         FROM ${TEMP_USER_SLICES} u
        WHERE ${ALPHAA_REGION_WHERE}
          AND EXISTS (
            SELECT 1
              FROM temp_social_media_accounts sma
             WHERE sma.user_id = u.id
               AND ${accountInSliceSql("sma", "u")}
          )
        ORDER BY full_name ASC, u.id ASC`
    ),
  ]);

  const tempHolders: SpareMarkHolderOption[] = tempRows.map((row) => ({
    id: row.id,
    source: "temp",
    full_name: row.full_name,
    country: row.country,
    region: row.region,
    projects: row.country ? [row.country] : [],
  }));
  const alphaaHolders: SpareMarkHolderOption[] = alphaaRows.map((row) => {
    const country = row.country?.trim() || null;
    return {
      id: row.id,
      source: "alphaa",
      full_name: row.full_name,
      country: country ? overviewDisplayCountry(country, "Alphaa") : null,
      region: "Alphaa",
      projects: country ? [country] : [],
    };
  });

  return [...tempHolders, ...alphaaHolders];
}
