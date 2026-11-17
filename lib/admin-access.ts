import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import { fetchOpAccessScope, opMayManageRole, opScopeIncludes } from "@/lib/op-scope";
import {
  adminHrefForPage,
  ADMIN_NAV_PAGES,
} from "@/lib/admin-nav-pages";
import {
  permissionAllows,
  resolveUserPagePermissions,
} from "@/lib/admin-permissions";
import {
  isAdminWorkspaceRole,
  isFullAdminRole,
  isStrategyMutatorRole,
  normalizeRoleValue,
} from "@/lib/role-hierarchy";
import type { OpAccessScope } from "@/types/admin";
import type { Role } from "@/types/db";
import type {
  AdminPagePermissionRow,
  AdminPermissionAction,
  AdminPermissionPageKey,
} from "@/types/permissions";

export type AdminViewer = {
  userId: number;
  role: "admin" | "hoo" | "op";
  /** Null for full admin/HOO access; set for Operation Managers. */
  scope: OpAccessScope | null;
  /** May mutate employees / spare / overview tools. */
  canEdit: boolean;
  /** May create / edit / delete Strategy projects and countries. */
  canEditStrategy: boolean;
  /** Effective per-page CRUD (role defaults or user overrides). */
  permissions: AdminPagePermissionRow[];
};

export type FullAdminActor = {
  userId: number;
  role: "admin" | "hoo" | "op";
  /** Set for Operation Managers: what they may change. */
  scope: OpAccessScope | null;
};

export type StrategyAdminActor = {
  userId: number;
  role: "admin" | "hoo" | "op";
};

async function resolveViewerRole(
  userId: number,
  sessionRole: Role | string | undefined
): Promise<string | undefined> {
  // Prefer the live DB role so JWT can't leave HOO stuck as read-only OP.
  try {
    const row = await queryOne<{ role: string }>(
      `SELECT role
         FROM temp_users
        WHERE id = $1
          AND is_active = TRUE
          AND employment_status <> 'deactivated'`,
      [userId]
    );
    // Deactivated or deleted: no admin access, even with an old session role.
    return row?.role ? normalizeRoleValue(row.role) : undefined;
  } catch {
    // Fall back to the session role only if the DB lookup itself fails.
    return sessionRole ? normalizeRoleValue(sessionRole) : undefined;
  }
}

async function loadPermissions(
  userId: number,
  role: string
): Promise<AdminPagePermissionRow[]> {
  try {
    return await resolveUserPagePermissions(userId, role);
  } catch {
    return [];
  }
}

function flagsFromPermissions(
  pages: AdminPagePermissionRow[],
  fallback: { canEdit: boolean; canEditStrategy: boolean }
) {
  if (pages.length === 0) return fallback;
  return {
    canEdit:
      permissionAllows(pages, "employees", "canCreate") ||
      permissionAllows(pages, "employees", "canUpdate") ||
      permissionAllows(pages, "employees", "canDelete") ||
      permissionAllows(pages, "spare", "canUpdate") ||
      permissionAllows(pages, "overview", "canUpdate"),
    canEditStrategy:
      permissionAllows(pages, "strategy", "canCreate") ||
      permissionAllows(pages, "strategy", "canUpdate") ||
      permissionAllows(pages, "strategy", "canDelete"),
  };
}

function actorRole(
  role: string | undefined
): "admin" | "hoo" | "op" {
  const value = normalizeRoleValue(role);
  if (value === "hoo") return "hoo";
  if (value === "op") return "op";
  return "admin";
}

/** Legacy matrix used when permission tables are missing / empty. */
function legacyAllows(
  role: AdminViewer["role"],
  page: AdminPermissionPageKey,
  action: AdminPermissionAction
): boolean {
  if (action === "canRead") return true;
  // OP: edit employees and their accounts in their scope (no create / delete).
  if (role === "op") return page === "employees" && action === "canUpdate";
  if (page === "strategy") return role === "admin";
  if (page === "extract" || page === "activity") return false;
  return role === "admin" || role === "hoo";
}

export function viewerAllows(
  viewer: Pick<AdminViewer, "role" | "permissions">,
  page: AdminPermissionPageKey,
  action: AdminPermissionAction
): boolean {
  if (viewer.permissions.length === 0) {
    return legacyAllows(viewer.role, page, action);
  }
  return permissionAllows(viewer.permissions, page, action);
}

export function firstReadableAdminHref(
  viewer: Pick<AdminViewer, "role" | "permissions">
): string {
  for (const item of ADMIN_NAV_PAGES) {
    if (viewerAllows(viewer, item.pageKey, "canRead")) return item.href;
  }
  if (viewerAllows(viewer, "spare", "canRead")) return "/admin";
  return "/dashboard";
}

export function readableAdminNavPages(
  viewer: Pick<AdminViewer, "role" | "permissions">
) {
  return ADMIN_NAV_PAGES.filter((item) =>
    viewerAllows(viewer, item.pageKey, "canRead")
  );
}

export async function requireAdminViewer(): Promise<AdminViewer> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  const role = await resolveViewerRole(userId, session?.user?.role);

  if (!Number.isFinite(userId) || !isAdminWorkspaceRole(role)) {
    throw new Error("Unauthorized — admin workspace only.");
  }

  const permissions = await loadPermissions(userId, role ?? "employee");

  if (isFullAdminRole(role)) {
    const normalized = normalizeRoleValue(role) === "hoo" ? "hoo" : "admin";
    const flags = flagsFromPermissions(permissions, {
      canEdit: true,
      canEditStrategy: normalized === "admin",
    });
    return {
      userId,
      role: normalized,
      scope: null,
      permissions,
      ...flags,
    };
  }

  const scope = await fetchOpAccessScope(userId);
  const flags = flagsFromPermissions(permissions, {
    canEdit: false,
    canEditStrategy: false,
  });
  return {
    userId,
    role: "op",
    scope: scope ?? { projects: [], projectSlug: "", region: "Africa", countries: [] },
    permissions,
    ...flags,
  };
}

export async function getAdminViewerOrNull(): Promise<AdminViewer | null> {
  try {
    return await requireAdminViewer();
  } catch {
    return null;
  }
}

/** Ensure the viewer may read a page; otherwise redirect to the first allowed page. */
export async function requireAdminPageAccess(
  page: AdminPermissionPageKey
): Promise<AdminViewer> {
  const viewer = await getAdminViewerOrNull();
  if (!viewer) redirect("/login");
  if (!viewerAllows(viewer, page, "canRead")) {
    redirect(firstReadableAdminHref(viewer));
  }
  return viewer;
}

/**
 * Enforce a specific page CRUD action for mutations.
 * Throws when the effective permission matrix denies the action.
 */
export async function requirePagePermission(
  page: AdminPermissionPageKey,
  action: AdminPermissionAction
): Promise<AdminViewer> {
  const viewer = await requireAdminViewer();
  if (!viewerAllows(viewer, page, action)) {
    throw new Error(
      `Unauthorized — missing ${page} permission.`
    );
  }
  return viewer;
}

export const OUTSIDE_OP_SCOPE_ERROR =
  "Unauthorized — this person is outside your projects and countries.";

/** True when an Operation Manager may change this person (Admin / HOO: always). */
export function opMayManagePerson(
  scope: OpAccessScope | null,
  person: { role: string | null; region: string | null; country: string | null }
): boolean {
  if (!scope) return true;
  return opMayManageRole(person.role) && opScopeIncludes(scope, person.region, person.country);
}

/**
 * Operation Managers may only change employees, team leads and CMs in their own
 * projects and countries (or not yet given a country in their projects).
 */
export async function assertViewerMayManageUser(
  scope: OpAccessScope | null,
  userId: number
): Promise<void> {
  if (!scope) return;
  const person = await queryOne<{ role: string; region: string | null; country: string | null }>(
    `SELECT role, region, country FROM temp_users WHERE id = $1`,
    [userId]
  );
  if (!person || !opMayManagePerson(scope, person)) {
    throw new Error(OUTSIDE_OP_SCOPE_ERROR);
  }
}

/**
 * Page-scoped mutation gate (employees, spare, overview tools, etc.).
 */
export async function requireFullAdminActor(
  page: AdminPermissionPageKey = "employees",
  action: AdminPermissionAction = "canUpdate"
): Promise<FullAdminActor> {
  const viewer = await requirePagePermission(page, action);
  return { userId: viewer.userId, role: viewer.role, scope: viewer.scope };
}

/** Admin role only — managing another user's permission matrix. */
export async function requireAdminOnlyActor(): Promise<StrategyAdminActor> {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!Number.isFinite(userId)) {
    throw new Error("Unauthorized — admin only.");
  }

  const role = await resolveViewerRole(userId, session?.user?.role);
  if (!isStrategyMutatorRole(role)) {
    throw new Error("Unauthorized — admin only.");
  }

  return { userId, role: "admin" };
}

/**
 * Strategy create / save / delete / add country.
 * Uses effective page permissions (role defaults or per-user overrides).
 */
export async function requireStrategyAdminActor(
  action: AdminPermissionAction = "canUpdate"
): Promise<StrategyAdminActor> {
  const viewer = await requirePagePermission("strategy", action);
  return { userId: viewer.userId, role: viewer.role };
}

export function strategyPermissionActionForMethod(
  method: string
): AdminPermissionAction {
  if (method === "POST") return "canCreate";
  if (method === "DELETE") return "canDelete";
  return "canUpdate";
}

export { adminHrefForPage };
