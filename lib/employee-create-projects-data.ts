import {
  projectRegionValue,
  regionFromStrategyProjectSlug,
} from "@/lib/employee-create-projects";
import { fetchStrategyProjects } from "@/lib/strategy-projects-data";
import type { EmployeeCreateProjectOption } from "@/types/admin";

export async function fetchEmployeeCreateProjectOptions(): Promise<
  EmployeeCreateProjectOption[]
> {
  const projects = await fetchStrategyProjects();
  return projects.map((project) => ({
    slug: project.slug,
    name: project.name,
    region: projectRegionValue(project.slug, project.name),
    countries: [
      ...new Set(
        project.subProjects.map((child) => child.name.trim()).filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b)),
  }));
}

/** temp_users.region for a project slug (Strategy-created projects use their name). */
export async function regionForProjectSlug(slug: string): Promise<string> {
  const projects = await fetchEmployeeCreateProjectOptions();
  return regionFromStrategyProjectSlug(slug, projects);
}
