import type { Metadata } from "next";
import { fetchAdminCountryCoverage } from "@/lib/admin-country-coverage";
import { requireAdminPageAccess, viewerAllows } from "@/lib/admin-access";
import { AdminCoverageKpis } from "@/components/admin/AdminCoverageKpis";
import { AdminCountryCoverageSection } from "@/components/admin/AdminCountryCoverageSection";
import { AdminOverviewHeadingActions } from "@/app/(app)/admin/components/AdminOverviewHeadingActions";
import { AdminOverviewRegionTabs } from "@/components/admin/AdminOverviewRegionTabs";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { adminViewOverview } from "@/lib/admin-view";
import { adminRegionFromSlug } from "@/lib/region-config";
import { fetchStrategyProjects } from "@/lib/strategy-projects-data";

export const metadata: Metadata = {
  title: "Admin",
};

type AdminOverviewPageProps = {
  searchParams: Promise<{ region?: string }>;
};

export default async function AdminOverviewPage({
  searchParams,
}: AdminOverviewPageProps) {
  const viewer = await requireAdminPageAccess("overview");

  const params = await searchParams;
  const requestedRegion = adminRegionFromSlug(params.region);
  const opScope = viewer.role === "op" ? viewer.scope : null;
  // OPs: the project tab they picked if it's one of theirs, else their first.
  const opProject = opScope
    ? (opScope.projects.find(
        (project) => adminRegionFromSlug(project.projectSlug) === requestedRegion
      ) ?? opScope.projects[0] ?? null)
    : null;
  const region = opProject
    ? adminRegionFromSlug(opProject.projectSlug)
    : requestedRegion;

  // Independent loads: fetch together instead of one after the other.
  const [strategyProjects, coverage] = await Promise.all([
    fetchStrategyProjects(),
    fetchAdminCountryCoverage({
      region,
      countries: opScope ? (opProject?.countries ?? []) : undefined,
    }),
  ]);

  const projects =
    opScope
      ? strategyProjects
          .filter((project) =>
            opScope.projects.some((item) => item.projectSlug === project.slug)
          )
          .map((project) => ({ slug: project.slug, name: project.name }))
      : strategyProjects.map((project) => ({
          slug: project.slug,
          name: project.name,
        }));

  return (
    <AdminWorkspace
      view={adminViewOverview()}
      actions={
        <AdminOverviewHeadingActions
          region={region}
          canCreateEmployees={viewerAllows(viewer, "employees", "canCreate")}
          canBalanceSpare={viewerAllows(viewer, "spare", "canUpdate")}
        />
      }
    >
      <AdminOverviewRegionTabs
        region={region}
        projects={projects}
        hideAllRegions={viewer.role === "op"}
      >
        <AdminCoverageKpis coverage={coverage} />
        <AdminCountryCoverageSection
          coverage={coverage}
          region={region}
          projectName={
            projects.find((project) => project.slug === region)?.name ??
            projects.find(
              (project) =>
                (project.slug === "africa" && region === "Africa") ||
                (project.slug === "europe" && region === "Europe") ||
                (project.slug === "alphaa" && region === "Alphaa")
            )?.name
          }
        />
      </AdminOverviewRegionTabs>
    </AdminWorkspace>
  );
}
