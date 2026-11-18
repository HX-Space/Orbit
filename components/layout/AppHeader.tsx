import {
  fetchAdminSpareAccounts,
  fetchAdminSpareMarkHolders,
} from "@/lib/admin-accounts-data";
import {
  getAdminViewerOrNull,
  readableAdminNavPages,
  viewerAllows,
} from "@/lib/admin-access";
import { AdminHeaderNav } from "@/components/layout/AdminHeaderNav";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { isAdminWorkspaceRole } from "@/lib/role-hierarchy";
import { opScopeIncludes } from "@/lib/op-scope";
import type { AppHeaderProps } from "@/types/layout";
import type { AdminPermissionPageKey } from "@/types/permissions";
import Link from "next/link";

function headerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || "U").toUpperCase();
}

export async function AppHeader({
  name,
  email,
  role,
  roleLabel,
}: AppHeaderProps) {
  const isAdminWorkspace = isAdminWorkspaceRole(role);
  const initials = headerInitials(name);
  const viewer = isAdminWorkspace ? await getAdminViewerOrNull() : null;
  // Search data loads when search opens (see HeaderSearch), not with every page.
  let [spareAccounts, spareHolders] = isAdminWorkspace
    ? await Promise.all([fetchAdminSpareAccounts(), fetchAdminSpareMarkHolders()])
    : [[], []];

  if (viewer?.role === "op" && viewer.scope) {
    const scope = viewer.scope;
    // One of the OP's projects and its countries (Sudan / Somalia are Africa and
    // Main, Palestine is Main and Asia, Africa 2 shares Africa's countries).
    spareAccounts = spareAccounts.filter((account) =>
      opScopeIncludes(
        scope,
        account.source === "alphaa" ? "Alphaa" : account.region,
        account.country
      )
    );
    spareHolders = spareHolders.filter(
      (holder) =>
        Boolean(holder.region?.trim()) &&
        opScopeIncludes(scope, holder.region, holder.country)
    );
  }

  const canReadSpare = viewer ? viewerAllows(viewer, "spare", "canRead") : false;
  if (!canReadSpare) {
    spareAccounts = [];
    spareHolders = [];
  }

  const allowedPages: AdminPermissionPageKey[] = viewer
    ? [
        ...readableAdminNavPages(viewer).map((item) => item.pageKey),
        ...(canReadSpare ? (["spare"] as const) : []),
      ]
    : [];

  return (
    <header
      className={`relative isolate z-50 border-b border-[var(--color-hairline)] bg-[var(--color-surface)] ${
        isAdminWorkspace ? "xl:h-16" : "h-16"
      }`}
    >
      <div
        className={[
          // Admin: below xl the section links drop to their own scrollable row.
          isAdminWorkspace
            ? "mx-auto flex w-full flex-wrap items-center justify-between gap-x-3 px-4 sm:px-8 xl:h-full xl:flex-nowrap"
            : "mx-auto flex h-full w-full items-center justify-between gap-3 px-4 sm:px-8",
          isAdminWorkspace || role === "manager"
            ? "max-w-[1600px]"
            : "max-w-7xl",
        ].join(" ")}
      >
        <div
          className={`flex min-w-0 items-center gap-2 sm:gap-4 ${
            isAdminWorkspace ? "h-16 xl:h-full" : ""
          }`}
        >
          <Link
            href="/"
            aria-label="Orbit home"
            className="inline-flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
          >
            <BrandLogo size="header" priority />
          </Link>
        </div>

        {isAdminWorkspace ? (
          <div className="order-last flex h-12 w-full min-w-0 border-t border-[var(--color-hairline)] xl:order-none xl:h-full xl:w-auto xl:flex-1 xl:border-t-0 xl:pl-1">
            <AdminHeaderNav
              spareCount={spareAccounts.length}
              spareAccounts={spareAccounts}
              spareHolders={spareHolders}
              allowedPages={allowedPages}
            />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {isAdminWorkspace ? (
            <HeaderSearch />
          ) : roleLabel ? (
            // Hidden on phones: it would cover the logo.
            <span className="hidden rounded-full bg-[var(--color-emerald)] px-3 py-1 sm:inline text-[11px] font-semibold uppercase tracking-[0.06em] text-white">
              {roleLabel}
            </span>
          ) : null}

          <ThemeToggle />
          <NotificationBell />
          <HeaderUserMenu
            name={name}
            email={email}
            role={role}
            initials={initials}
          />
        </div>
      </div>
    </header>
  );
}
