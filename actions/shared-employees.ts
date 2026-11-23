"use server";

import { revalidatePath } from "next/cache";
import { requireFullAdminActor } from "@/lib/admin-access";
import { pool, queryOne } from "@/lib/db";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { logOrbitAction } from "@/lib/orbit-log";
import { setupCountriesForRegion, type SetupRegion } from "@/lib/setup-options";
import { TEMP_USER_SLICES, accountInSliceSql } from "@/lib/shared-employee-sql";
import { sharedPlaceKey } from "@/lib/shared-places";
import type { SharedPlace } from "@/types/admin";

const ONLY_ADMIN_HOD =
  "Only an Admin or Head of Department can change a shared employee's projects.";

async function requireAdminOrHod() {
  const actor = await requireFullAdminActor("employees", "canUpdate");
  if (actor.role !== "admin" && actor.role !== "hoo") throw new Error(ONLY_ADMIN_HOD);
  return actor;
}

/** Turn "Shared employee" on/off and set the extra projects / countries they work in. */
export async function updateEmployeeSharedPlaces(
  userId: number,
  input: { isShared: boolean; places: SharedPlace[] }
): Promise<void> {
  await requireAdminOrHod();
  if (!Number.isFinite(userId)) throw new Error("Invalid employee.");

  const user = await queryOne<{ region: string | null; country: string | null }>(
    `SELECT region, country FROM temp_users WHERE id = $1 AND role = 'employee'`,
    [userId]
  );
  if (!user) throw new Error("Only employees can be shared.");

  const projects = await fetchEmployeeCreateProjectOptions();
  const homeKey = sharedPlaceKey({ region: user.region ?? "", country: user.country ?? "" });
  const seen = new Set<string>([homeKey]);
  const places: SharedPlace[] = [];
  if (input.isShared) {
    for (const raw of input.places) {
      const place = { region: raw.region.trim(), country: raw.country.trim() };
      if (!place.region || !place.country) continue;
      const allowed = setupCountriesForRegion(place.region as SetupRegion, projects);
      if (!allowed.includes(place.country)) {
        throw new Error(`${place.country} is not a country in the ${place.region} project.`);
      }
      const key = sharedPlaceKey(place);
      if (seen.has(key)) continue;
      seen.add(key);
      places.push(place);
    }
    if (places.length === 0) {
      throw new Error("Add at least one more project and country for a shared employee.");
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE temp_users SET is_shared = $2, updated_at = NOW() WHERE id = $1`, [
      userId,
      input.isShared,
    ]);
    await client.query(`DELETE FROM temp_user_extra_assignments WHERE user_id = $1`, [userId]);
    for (const place of places) {
      await client.query(
        `INSERT INTO temp_user_extra_assignments (user_id, region, country) VALUES ($1, $2, $3)`,
        [userId, place.region, place.country]
      );
    }
    // Accounts left on a place they no longer work in go back to the home place.
    await client.query(
      `UPDATE temp_social_media_accounts a
          SET assigned_region = NULL, assigned_country = NULL
        WHERE a.user_id = $1
          AND (a.assigned_region IS NOT NULL OR a.assigned_country IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM ${TEMP_USER_SLICES} u
             WHERE u.id = a.user_id
               AND u.is_extra_slice = TRUE
               AND ${accountInSliceSql("a", "u")}
          )`,
      [userId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${userId}`);
  await logOrbitAction({
    action: "update",
    resource: "employee",
    summary: input.isShared
      ? `Marked employee #${userId} as shared (${places.length} extra ${places.length === 1 ? "place" : "places"})`
      : `Employee #${userId} is no longer shared`,
    details: { userId, isShared: input.isShared, places },
  });
}

/** Choose which of a shared employee's places one account counts for. */
export async function setAdminAccountPlace(
  accountId: number,
  place: SharedPlace
): Promise<{ error?: string }> {
  try {
    await requireAdminOrHod();
    if (!Number.isFinite(accountId)) return { error: "Invalid account." };
    const slice = await queryOne<{ user_id: number; is_extra_slice: boolean }>(
      `SELECT a.user_id, u.is_extra_slice
         FROM temp_social_media_accounts a
         INNER JOIN ${TEMP_USER_SLICES} u ON u.id = a.user_id
        WHERE a.id = $1
          AND LOWER(TRIM(COALESCE(u.region, ''))) = LOWER(TRIM($2))
          AND LOWER(TRIM(COALESCE(u.country, ''))) = LOWER(TRIM($3))
        LIMIT 1`,
      [accountId, place.region, place.country]
    );
    if (!slice) return { error: "This employee does not work in that project and country." };

    await pool.query(
      `UPDATE temp_social_media_accounts
          SET assigned_region = $2, assigned_country = $3, updated_at = NOW()
        WHERE id = $1`,
      slice.is_extra_slice
        ? [accountId, place.region, place.country]
        : [accountId, null, null]
    );
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${slice.user_id}`);
    await logOrbitAction({
      action: "update",
      resource: "account",
      summary: `Account #${accountId} now counts for ${place.region} · ${place.country}`,
      details: { accountId, userId: slice.user_id, ...place },
    });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not move the account." };
  }
}
