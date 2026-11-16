import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "@/types/db";
import {
  isAdminWorkspaceRole,
  ROLE_LABELS,
} from "@/lib/role-hierarchy";
import { AppHeader } from "@/components/layout/AppHeader";
import { queryOne } from "@/lib/db";
import { ChangePasswordForm } from "./settings/components/ChangePasswordForm";

/** True after an admin reset; false if migration 0028 has not run yet. */
async function mustChangePassword(userId: number): Promise<boolean> {
  if (!Number.isFinite(userId)) return false;
  try {
    const row = await queryOne<{ must_change_password: boolean }>(
      `SELECT must_change_password FROM temp_users WHERE id = $1`,
      [userId]
    );
    return Boolean(row?.must_change_password);
  } catch {
    return false;
  }
}

function roleBadgeLabel(role: Role) {
  if (role === "team_lead") return `QC · ${ROLE_LABELS.team_lead}`;
  if (role === "admin") return ROLE_LABELS.admin;
  if (role === "hoo") return ROLE_LABELS.hoo;
  if (role === "manager") return ROLE_LABELS.manager;
  if (role === "op") return ROLE_LABELS.op;
  return null;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const name = session.user?.name ?? "User";
  const email = session.user?.email ?? "";
  const role = (session.user?.role ?? "employee") as Role;
  const roleLabel = roleBadgeLabel(role);
  const forceChange = await mustChangePassword(Number(session.user?.id));

  return (
    <div className="min-h-dvh bg-[var(--color-cream)]">
      <AppHeader
        name={name}
        email={email}
        role={role}
        roleLabel={roleLabel}
      />

      <div
        className={[
          "mx-auto w-full px-3 sm:px-8",
          isAdminWorkspaceRole(role) || role === "manager"
            ? "max-w-[1600px]"
            : "max-w-7xl",
          isAdminWorkspaceRole(role) ? "py-4 sm:py-6" : "py-8",
        ].join(" ")}
      >
        {forceChange ? (
          <section
            className="mx-auto max-w-xl rounded-[var(--radius-card)] bg-[var(--color-surface)] p-6 sm:p-8"
            style={{ boxShadow: "0 1px 2px rgba(20,20,20,.04)" }}
          >
            <h1 className="text-[22px] font-extrabold text-[var(--color-ink)] sm:text-[26px]">
              Set a new password
            </h1>
            <p className="mb-5 mt-1 text-[15px] text-[var(--color-muted)]">
              Your password was reset. Enter the temporary one, then choose
              your own.
            </p>
            <ChangePasswordForm email={email} />
          </section>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
