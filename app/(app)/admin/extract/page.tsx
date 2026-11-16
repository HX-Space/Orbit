import type { Metadata } from "next";
import { requireAdminPageAccess } from "@/lib/admin-access";
import { ALL_SETUP_COUNTRIES, isBuiltInSetupRegion } from "@/lib/setup-options";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { adminViewExtract } from "@/lib/admin-view";
import { ExtractTool } from "./components/ExtractTool";

export const metadata: Metadata = {
  title: "Data extract",
};

export default async function AdminExtractPage() {
  const viewer = await requireAdminPageAccess("extract");

  // Projects created in Strategy (built-in ones are already in the filter).
  const scope = viewer.role === "op" ? viewer.scope : null;
  const projects = (await fetchEmployeeCreateProjectOptions())
    .filter((project) => !isBuiltInSetupRegion(project.region))
    .filter(
      (project) =>
        !scope || scope.projects.some((item) => item.region === project.region)
    )
    .map(({ region, name, countries }) => ({ region, name, countries }));

  const countries = scope
    ? scope.countries
    : [
        ...new Set([
          ...ALL_SETUP_COUNTRIES,
          ...projects.flatMap((project) => project.countries),
        ]),
      ];

  return (
    <AdminWorkspace view={adminViewExtract()}>
      <ExtractTool countries={countries} projects={projects} />
    </AdminWorkspace>
  );
}
