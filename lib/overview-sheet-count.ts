/**
 * Overview numbers that match the Google Sheets sync.
 *
 * - fetchSheetAccountCount: the accounts the sync writes for this tab, using
 *   the same rule as the export (every non-spare account; Africa / Europe /
 *   Asia need an active employee holder, Main sends every Main account).
 * - extraAccountHolders: people who hold more accounts on a platform than
 *   their planned slot, with project, country, Country Manager and platforms.
 */
import { query } from "@/lib/db";
import { extractPlatformLabel } from "@/lib/admin-extract-platform";
import { ALPHAA_LEGACY_COUNTRY } from "@/lib/alphaa-platform-sql";
import { regionDisplayLabel } from "@/lib/project-labels";
import { TEMP_USER_SLICES, accountInSliceSql } from "@/lib/shared-employee-sql";
import {
  tempRegionClause,
  type TempCoverageRegionScope,
} from "@/lib/temp-country-coverage-data";
import { TEMP_USER_COUNTRY } from "@/lib/temp-country-sql";
import type {
  AdminCountryCoverageRow,
  AdminCoverageCount,
  ExtraAccountHolder,
} from "@/types/admin";

export async function fetchSheetAccountCount(options: {
  region: string | undefined;
  tempRegionScope: TempCoverageRegionScope | undefined;
  projectRegion: string | undefined;
  countries: string[] | null;
}): Promise<number> {
  const region = options.region ?? "Overview";
  const wantMain = region === "Overview" || region === "Alphaa";
  const wantTemp = region !== "Alphaa";

  let total = 0;
  if (wantTemp) {
    const params: unknown[] = [];
    let where = "";
    if (options.projectRegion) {
      params.push(options.projectRegion.toLowerCase());
      where += ` AND LOWER(TRIM(u.region)) = $${params.length}`;
    } else if (region !== "Overview") {
      where += tempRegionClause(options.tempRegionScope);
    }
    if (options.countries) {
      params.push(options.countries);
      where += ` AND ${TEMP_USER_COUNTRY} = ANY($${params.length}::text[])`;
    }
    const [row] = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM temp_social_media_accounts a
         INNER JOIN ${TEMP_USER_SLICES} u
           ON u.id = a.user_id AND ${accountInSliceSql("a", "u")}
        WHERE u.role = 'employee'
          AND u.is_active = TRUE
          AND a.is_spare = FALSE
          AND u.region <> 'Alphaa'${where}`,
      params
    );
    total += row?.n ?? 0;
  }
  if (wantMain) {
    const params: unknown[] = [];
    let where = "";
    if (options.countries && region === "Alphaa") {
      params.push(options.countries);
      where = ` AND ${ALPHAA_LEGACY_COUNTRY} = ANY($1::text[])`;
    }
    const [row] = await query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM temp_social_media_accounts sma
         INNER JOIN ${TEMP_USER_SLICES} u
           ON u.id = sma.user_id AND ${accountInSliceSql("sma", "u")}
        WHERE u.region = 'Alphaa'
          AND sma.is_spare = FALSE${where}`,
      params
    );
    total += row?.n ?? 0;
  }
  return total;
}

const CORE_PLATFORMS: [keyof AdminCountryCoverageRow, string][] = [
  ["x", "X"],
  ["facebookPersonal", "Facebook personal"],
  ["facebookUmbrella", "Facebook umbrella"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
];

/** People holding more accounts than their slot on any platform. */
export async function extraAccountHolders(
  rows: AdminCountryCoverageRow[]
): Promise<ExtraAccountHolder[]> {
  const found: Omit<ExtraAccountHolder, "project" | "countryManager">[] = [];
  for (const row of rows) {
    for (const holder of row.holders) {
      if (holder.vacant || holder.id == null) continue;
      const platforms: ExtraAccountHolder["platforms"] = [];
      for (const [key, label] of CORE_PLATFORMS) {
        const count = holder[key as keyof typeof holder] as AdminCoverageCount | undefined;
        if (count && count.actual > count.target) {
          platforms.push({ label, actual: count.actual, target: count.target, extra: count.actual - count.target });
        }
      }
      for (const [key, count] of Object.entries(holder.extraPlatforms ?? {})) {
        if (count && count.actual > count.target) {
          platforms.push({
            label: extractPlatformLabel(key),
            actual: count.actual,
            target: count.target,
            extra: count.actual - count.target,
          });
        }
      }
      if (platforms.length === 0) continue;
      found.push({
        id: holder.id,
        source: holder.source,
        name: holder.fullName,
        country: row.country,
        platforms,
        extraTotal: platforms.reduce((sum, item) => sum + item.extra, 0),
      });
    }
  }
  if (found.length === 0) return [];

  // Project and Country Manager: direct manager, else the Team Leader's manager,
  // else a Country Manager who covers that country in the same project.
  const ids = [...new Set(found.map((item) => item.id))];
  const people = await query<{ id: number; region: string | null; cm: string | null }>(
    `SELECT u.id, u.region,
            COALESCE(m.full_name, tlm.full_name, (
              SELECT cm.full_name
                FROM temp_manager_countries mc
                INNER JOIN temp_users cm ON cm.id = mc.user_id
               WHERE cm.role = 'manager' AND cm.is_active = TRUE
                 AND LOWER(TRIM(mc.country)) = LOWER(TRIM(u.country))
                 AND LOWER(TRIM(COALESCE(cm.region, ''))) = LOWER(TRIM(COALESCE(u.region, '')))
               ORDER BY cm.full_name
               LIMIT 1
            )) AS cm
       FROM temp_users u
       LEFT JOIN temp_users m ON m.id = u.manager_id
       LEFT JOIN temp_users tl ON tl.id = u.team_lead_id
       LEFT JOIN temp_users tlm ON tlm.id = tl.manager_id
      WHERE u.id = ANY($1::int[])`,
    [ids]
  );
  const byId = new Map(people.map((person) => [person.id, person]));
  return found
    .map((item) => {
      const person = byId.get(item.id);
      return {
        ...item,
        project: regionDisplayLabel(person?.region?.trim() ?? "") || "—",
        countryManager: person?.cm ?? null,
      };
    })
    .sort((a, b) => b.extraTotal - a.extraTotal || a.name.localeCompare(b.name));
}
