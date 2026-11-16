import type { Metadata } from "next";
import { requireAdminPageAccess, viewerAllows } from "@/lib/admin-access";
import { fetchAdminEmployeesList } from "@/lib/admin-data";
import { opScopeIncludes } from "@/lib/op-scope";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import {
  employeeListStatusCounts,
  filterEmployeesByListStatus,
  parseEmployeeListStatus,
} from "@/lib/admin-employee-list";
import { EmployeesTable } from "@/components/admin/EmployeesTable";
import { EmployeesHeadingActions } from "@/app/(app)/admin/employees/components/EmployeesHeadingActions";
import { EmployeesTableToolbar } from "@/app/(app)/admin/employees/components/EmployeesTableToolbar";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { adminViewEmployees } from "@/lib/admin-view";
import { baseCountryFromDisplay } from "@/lib/overview-country-display";
import { fetchEmployeeFilterCountries } from "@/lib/employee-filter-countries";
import {
  employeeListRegionFromSlug,
  isCountryInEmployeeListRegion,
  type SetupRegion,
} from "@/lib/setup-options";

export const metadata: Metadata = {
  title: "Employees",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const viewer = await requireAdminPageAccess("employees");
  const canCreateEmployees = viewerAllows(viewer, "employees", "canCreate");

  const sp = (await searchParams) ?? {};
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = parseEmployeeListStatus(
    typeof sp.status === "string" ? sp.status : undefined
  );
  const roleRaw = typeof sp.role === "string" ? sp.role : "all";
  const role =
    roleRaw === "employee" ||
    roleRaw === "manager" ||
    roleRaw === "team_lead" ||
    roleRaw === "op" ||
    roleRaw === "hoo" ||
    roleRaw === "admin"
      ? roleRaw
      : "all";

  const projects = await fetchEmployeeCreateProjectOptions();
  const regionFilter = employeeListRegionFromSlug(
    typeof sp.region === "string" ? sp.region : undefined,
    projects
  );
  let region = regionFilter === "all" ? undefined : regionFilter;
  const countryRaw = typeof sp.country === "string" ? sp.country : "";
  let country = isCountryInEmployeeListRegion(countryRaw, regionFilter, projects)
    ? countryRaw
    : "";

  if (viewer.role === "op" && viewer.scope) {
    const scope = viewer.scope;
    // One project: list only it. Several: keep the filter picked, if it's theirs.
    if (scope.projects.length === 1) {
      region = scope.region as SetupRegion;
    } else if (region && !scope.projects.some((item) => item.region === region)) {
      region = undefined;
    }
    if (country && !scope.countries.includes(country)) {
      country = "";
    }
  }

  let [listed, filterCountries] = await Promise.all([
    fetchAdminEmployeesList({
      q,
      role: role === "all" ? undefined : role,
      region,
      country: country || undefined,
    }),
    fetchEmployeeFilterCountries(),
  ]);
  if (viewer.role === "op" && viewer.scope) {
    // Operation Managers: only their own project and countries in the dropdowns.
    const scope = viewer.scope;
    filterCountries = filterCountries.filter((item) =>
      opScopeIncludes(scope, item.region, item.country)
    );
  }

  // Admin accounts are listed for Admins only.
  if (viewer.role !== "admin") {
    listed = listed.filter((row) => row.role !== "admin");
  }

  if (viewer.role === "op" && viewer.scope) {
    const scope = viewer.scope;
    const allowed = new Set(scope.countries);
    listed = listed.filter((row) => {
      // Operation Managers don't see themselves in their own team list.
      if (row.source === "temp" && row.id === viewer.userId) return false;
      const base = baseCountryFromDisplay(row.country ?? "");
      if (!allowed.has(base) && !(row.country && allowed.has(row.country))) {
        return false;
      }
      // Employees: one of the OP's projects and that project's countries.
      if (row.role === "employee") {
        return (
          Boolean(row.region?.trim()) &&
          opScopeIncludes(scope, row.region, row.country)
        );
      }
      return true;
    });
  }

  const counts = employeeListStatusCounts(listed);
  const rows = filterEmployeesByListStatus(listed, status);
  const holders = listed
    .filter(
      (row) =>
        row.role === "employee" && (row.is_active || row.source === "alphaa")
    )
    .map((row) => ({
      id: row.id,
      source: row.source,
      full_name: row.full_name,
      country: row.country,
      language: row.language,
      team_lead_name: row.team_lead_name,
      manager_name: row.manager_name,
      region: row.region,
    }));

  return (
    <AdminWorkspace
      view={adminViewEmployees()}
      actions={
        <EmployeesHeadingActions canCreateEmployees={canCreateEmployees} />
      }
    >
      <EmployeesTable
        key={`${q}|${status}|${role}|${region ?? ""}|${country}`}
        rows={rows}
        holders={holders}
        canManagePermissions={viewer.role === "admin"}
        toolbar={
          <EmployeesTableToolbar
            initialQ={q}
            counts={counts}
            holders={holders}
            canCreateEmployees={canCreateEmployees}
            filterCountries={filterCountries}
            projects={projects}
          />
        }
      />
    </AdminWorkspace>
  );
}
