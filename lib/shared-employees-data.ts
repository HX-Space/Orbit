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
