import { query, queryOne } from "@/lib/db";
import type { SharedPlace } from "@/types/admin";

export type EmployeeSharedSettings = {
  is_shared: boolean;
  /** Extra projects / countries (the home place is the person's own). */
  extra_places: SharedPlace[];
};

export async function fetchEmployeeSharedSettings(
  userId: number
): Promise<EmployeeSharedSettings> {
  const [user, places] = await Promise.all([
    queryOne<{ is_shared: boolean }>(
      `SELECT is_shared FROM temp_users WHERE id = $1`,
      [userId]
    ),
    query<SharedPlace>(
      `SELECT region, country
         FROM temp_user_extra_assignments
        WHERE user_id = $1
        ORDER BY id`,
      [userId]
    ),
  ]);
  return { is_shared: user?.is_shared === true, extra_places: places };
}

/**
 * The shared employee's extra place for this country (and project, if given),
 * or null when it is their home place / they are not shared. Accounts imported
 * or added there belong to that place only.
 */
export async function extraPlaceFor(
  userId: number,
  place: { country: string; region?: string | null }
): Promise<SharedPlace | null> {
  const country = place.country?.trim();
  if (!country) return null;
  const region = place.region?.trim() || null;
  const row = await queryOne<SharedPlace>(
    `SELECT region, country
       FROM temp_user_slices
      WHERE id = $1
        AND is_extra_slice = TRUE
        AND LOWER(TRIM(country)) = LOWER($2)
        AND ($3::text IS NULL OR LOWER(TRIM(region)) = LOWER($3))
      LIMIT 1`,
    [userId, country, region]
  );
  return row ? { region: row.region.trim(), country: row.country.trim() } : null;
}
