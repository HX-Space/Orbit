import { AdminNewEmployeeButton } from "@/app/(app)/admin/components/AdminNewEmployeeButton";
import { SyncSheetsButton } from "@/components/admin/SyncSheetsButton";
import type { AdminOverviewHeadingActionsProps } from "@/types/admin";

export function AdminOverviewHeadingActions({
  region,
  canCreateEmployees = true,
  canSyncSheets = true,
}: AdminOverviewHeadingActionsProps) {
  // "Fit to plan" is hidden; the Overview syncs Google Sheets instead.
  void region;
  return (
    <div className="flex shrink-0 items-center gap-2">
      {canSyncSheets ? <SyncSheetsButton variant="button" label="Sync sheets" /> : null}
      {canCreateEmployees ? <AdminNewEmployeeButton /> : null}
    </div>
  );
}
