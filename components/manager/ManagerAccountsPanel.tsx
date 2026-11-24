"use client";

import { ManagerAccountsTable } from "@/components/manager/ManagerAccountsTable";
import { ManagerBulkImportButton } from "@/components/manager/ManagerBulkImportButton";
import { ManagerAddAccountButton } from "@/components/manager/ManagerAddAccountButton";
import { useManagerPermissions } from "@/components/manager/ManagerPermissionsContext";
import type { ManagerAccountsPanelProps } from "@/types/manager";

export function ManagerAccountsPanel({
  holderId,
  fullName,
  country,
  language,
  accounts,
  assignedCount,
  holderOptions,
  importHolders,
  allowedCountries,
  region,
}: ManagerAccountsPanelProps) {
  const total = accounts.length;
  // This row first, with this row's country: a shared employee's South Korea
  // row imports into South Korea, not their home country.
  const rowImportHolders = [
    ...importHolders
      .filter((holder) => holder.id === holderId)
      .slice(0, 1)
      .map((holder) => ({ ...holder, country, region: region ?? holder.region })),
    ...importHolders.filter((holder) => holder.id !== holderId),
  ];
  const { team } = useManagerPermissions();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-[var(--color-muted)]">
          {assignedCount > 0
            ? `${total} of ${assignedCount} assigned accounts`
            : `${total} ${total === 1 ? "account" : "accounts"}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {team.canUpdate ? (
            <ManagerBulkImportButton
              holders={rowImportHolders}
              allowedCountries={allowedCountries}
              initialHolderId={holderId}
            />
          ) : null}
          {team.canCreate ? (
            <ManagerAddAccountButton
              holderId={holderId}
              fullName={fullName}
              holderOptions={holderOptions}
              place={region ? { region, country } : null}
            />
          ) : null}
        </div>
      </div>
      {accounts.length === 0 ? (
        <p className="rounded-lg bg-[var(--color-cream-tint)] px-4 py-6 text-center text-[14px] text-[var(--color-muted)]">
          No social accounts have been added for {fullName} yet.
        </p>
      ) : (
        <ManagerAccountsTable
          holderId={holderId}
          fullName={fullName}
          country={country}
          language={language}
          accounts={accounts}
          holderOptions={holderOptions}
        />
      )}
    </div>
  );
}
