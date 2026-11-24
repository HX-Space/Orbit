import { AdminKpiTile } from "@/components/admin/AdminKpiTile";
import { ExtraAccountsKpi } from "@/components/admin/ExtraAccountsKpi";
import type { AdminCoverageKpisProps } from "@/types/admin";

function remaining(actual: number, target: number) {
  return Math.max(0, target - actual);
}

export function AdminCoverageKpis({ coverage }: AdminCoverageKpisProps) {
  const { totals, rows, onHoldCount, spareCount } = coverage;
  const countriesOnPlan = rows.filter((row) => row.onPlan).length;
  const countriesFilled = rows.filter(
    (row) =>
      row.onPlan &&
      row.resources.actual >= row.resources.target &&
      row.totalAccounts.actual >= row.totalAccounts.target
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-7">
      <AdminKpiTile
        icon="users"
        title="Employees"
        value={`${totals.resources.actual} / ${totals.resources.target}`}
        subtitle="Active vs planned resources"
      />
      <AdminKpiTile
        icon="layers"
        title="Accounts"
        // Same count as the Google Sheets sync (every non-spare account).
        value={`${coverage.sheetAccountCount ?? totals.totalAccounts.actual} / ${totals.totalAccounts.target}`}
        subtitle={
          coverage.sheetAccountCount === undefined
            ? "Added vs planned slots"
            : "All accounts sent to Google Sheets vs planned"
        }
      />
      <AdminKpiTile
        icon="clipboard"
        title="Still to add"
        value={String(remaining(totals.totalAccounts.actual, totals.totalAccounts.target))}
        subtitle="Account slots left on the plan"
      />
      {coverage.extraHolders ? <ExtraAccountsKpi holders={coverage.extraHolders} /> : null}
      <AdminKpiTile
        icon="spare"
        title="Spare"
        value={String(spareCount)}
        subtitle="Extra accounts marked spare"
      />
      <AdminKpiTile
        icon="pause"
        title="On Hold"
        value={String(onHoldCount)}
        subtitle="Users with On Hold status"
      />
      <AdminKpiTile
        icon="globe"
        title="Countries ready"
        value={`${countriesFilled} / ${countriesOnPlan}`}
        subtitle="Countries that meet employee and account totals"
      />
    </div>
  );
}
