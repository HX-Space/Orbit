import { query } from "@/lib/db";
import { extractPlatformLabel } from "@/lib/admin-extract-platform";
import { baseCountryFromDisplay } from "@/lib/overview-country-display";
import { regionDisplayLabel } from "@/lib/project-labels";
import { adminCountryPlansForRegion } from "@/lib/strategy-plans-data";
import type { OnHoldEmployee } from "@/types/admin";

/** Employees with the On Hold status in an Overview tab, with who they work with. */
export async function fetchOnHoldEmployees(region: string): Promise<OnHoldEmployee[]> {
  const key = region.trim().toLowerCase();
  // Same rule as the On Hold card: the tab's planned countries, not Main.
  const planCountries = (await adminCountryPlansForRegion(region)).map((plan) =>
    baseCountryFromDisplay(plan.country)
  );
  const params: unknown[] = [planCountries];
  let regionWhere = ` AND u.region <> 'Alphaa'
          AND INITCAP(TRIM(COALESCE(u.country, ''))) = ANY($1::text[])`;
  if (key && key !== "overview") {
    if (key === "europe" || key === "balkan") {
      regionWhere += ` AND LOWER(TRIM(u.region)) IN ('europe', 'balkan')`;
    } else {
      params.push(key);
      regionWhere += ` AND LOWER(TRIM(u.region)) = $${params.length}`;
    }
  }

  // Country Manager: direct, else the Team Leader's, else one covering the country
  // in the same project. Operation Manager: direct, else the Country Manager's.
  const people = await query<{
    id: number;
    full_name: string;
    region: string | null;
    country: string | null;
    cm: string | null;
    op: string | null;
  }>(
    `WITH base AS (
       SELECT u.id, u.full_name, u.region, u.country, u.op_id,
              COALESCE(u.manager_id, tl.manager_id, (
                SELECT cm.id
                  FROM temp_manager_countries mc
                  INNER JOIN temp_users cm ON cm.id = mc.user_id
                 WHERE cm.role = 'manager' AND cm.is_active = TRUE
                   AND LOWER(TRIM(mc.country)) = LOWER(TRIM(u.country))
                   AND LOWER(TRIM(COALESCE(cm.region, ''))) = LOWER(TRIM(COALESCE(u.region, '')))
                 ORDER BY cm.full_name
                 LIMIT 1
              )) AS cm_id
         FROM temp_users u
         LEFT JOIN temp_users tl ON tl.id = u.team_lead_id
        WHERE u.role = 'employee'
          AND u.employment_status = 'on_hold'${regionWhere}
     )
     SELECT b.id, b.full_name, b.region, b.country,
            cm.full_name AS cm,
            COALESCE(op.full_name, cmop.full_name) AS op
       FROM base b
       LEFT JOIN temp_users cm ON cm.id = b.cm_id
       LEFT JOIN temp_users op ON op.id = b.op_id
       LEFT JOIN temp_users cmop ON cmop.id = cm.op_id
      ORDER BY b.region, b.country, b.full_name`,
    params
  );
  if (people.length === 0) return [];

  const counts = await query<{ user_id: number; platform: string; n: number }>(
    `SELECT user_id, platform, COUNT(*)::int AS n
       FROM temp_social_media_accounts
      WHERE user_id = ANY($1::int[]) AND is_spare = FALSE
      GROUP BY user_id, platform`,
    [people.map((person) => person.id)]
  );
  const platformsBy = new Map<number, { label: string; count: number }[]>();
  for (const row of counts) {
    const list = platformsBy.get(row.user_id) ?? [];
    list.push({ label: extractPlatformLabel(row.platform), count: row.n });
    platformsBy.set(row.user_id, list);
  }

  return people.map((person) => {
    const platforms = (platformsBy.get(person.id) ?? []).sort((a, b) => b.count - a.count);
    return {
      id: person.id,
      name: person.full_name,
      region: person.region?.trim() ?? "",
      project: regionDisplayLabel(person.region?.trim() ?? "") || "—",
      country: person.country?.trim() ?? "",
      countryManager: person.cm,
      operationManager: person.op,
      platforms,
      totalAccounts: platforms.reduce((sum, item) => sum + item.count, 0),
    };
  });
}
