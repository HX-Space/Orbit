"use server";

import { auth, unstable_update } from "@/auth";
import { queryOne } from "@/lib/db";
import { logOrbitAction } from "@/lib/orbit-log";
import { ROLE_LABELS } from "@/lib/role-hierarchy";
import type { Role } from "@/types/db";

/**
 * "View as": an Admin / Head of Department sees Orbit exactly as another person
 * does, read only (lib/db.ts refuses every change while it is on).
 */
export async function startViewAs(userId: number): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Please sign in again." };
  if (session.viewAs) return { error: "Exit the current \"View as\" first." };
  const role = session.user.role;
  if (role !== "admin" && role !== "hoo") {
    return { error: "Only an Admin or Head of Department can view as another person." };
  }
  if (!Number.isFinite(userId) || String(userId) === session.user.id) {
    return { error: "Pick another person." };
  }
  const target = await queryOne<{ full_name: string; role: Role }>(
    `SELECT full_name, role FROM temp_users WHERE id = $1`,
    [userId]
  );
  if (!target) return { error: "Person not found." };

  await logOrbitAction({
    action: "view_as",
    resource: "employee",
    summary: `Started viewing as ${target.full_name} (${ROLE_LABELS[target.role] ?? target.role}), read only`,
    details: { viewedUserId: userId },
    actor: {
      id: Number(session.user.id),
      name: session.user.name ?? "",
      email: session.user.email ?? "",
      role,
    },
  });
  await unstable_update({ viewAsUserId: userId });
  return {};
}

export async function stopViewAs(): Promise<void> {
  const session = await auth();
  if (!session?.viewAs) return;
  await logOrbitAction({
    action: "view_as",
    resource: "employee",
    summary: `Stopped viewing as ${session.user.name ?? `#${session.user.id}`}`,
    details: { viewedUserId: Number(session.user.id) },
    actor: {
      id: Number(session.viewAs.realId),
      name: session.viewAs.realName,
      email: "",
      role: session.viewAs.realRole,
    },
  });
  await unstable_update({ viewAsUserId: null });
}
