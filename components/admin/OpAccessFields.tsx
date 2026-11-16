"use client";

import { AdminFieldError } from "@/components/admin/AdminFieldError";
import { CountryFlag } from "@/lib/country-icons";
import type { EmployeeCreateProjectOption, OpAccessFieldsProps } from "@/types/admin";

export function OpAccessFields({
  projects,
  access,
  projectError,
  countriesError,
  onToggleProject,
  onToggleCountry,
}: OpAccessFieldsProps) {
  const picked = access.flatMap((item) => {
    const project = projects.find((entry) => entry.slug === item.project_slug);
    return project ? [{ item, project }] : [];
  }) as { item: (typeof access)[number]; project: EmployeeCreateProjectOption }[];

  return (
    <div className="sm:col-span-2 flex flex-col gap-5">
      <fieldset>
        <legend className="text-[13px] font-semibold text-[var(--color-muted)]">
          Project access
        </legend>
        <p className="mt-1 text-[12px] font-medium text-[var(--color-muted)]">
          Choose one or more projects. The first one picked is the main project.
        </p>
        <div
          className={`mt-2 flex flex-wrap gap-2 rounded-lg border bg-[var(--color-cream-tint)] p-3 ${
            projectError ? "border-[var(--color-coral)]" : "border-[var(--color-hairline)]"
          }`}
        >
          {projects.map((project) => {
            const checked = access.some((item) => item.project_slug === project.slug);
            return (
              <label
                key={project.slug}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                  checked
                    ? "border-[var(--color-emerald)] bg-[var(--color-surface)] text-[var(--color-ink)]"
                    : "border-[var(--color-hairline)] text-[var(--color-muted)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleProject(project.slug)}
                  className="rounded outline-none"
                  aria-label={`Give access to ${project.name}`}
                />
                {project.name}
                {project.countries.length > 0 ? ` (${project.countries.length})` : ""}
              </label>
            );
          })}
        </div>
        <AdminFieldError id="create-op-project-error" message={projectError} />
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-semibold text-[var(--color-muted)]">
          Country access
        </legend>
        <p className="mt-1 text-[12px] font-medium text-[var(--color-muted)]">
          Choose which countries inside each project the Operation Manager can
          view. They will only see employees, spare, strategy, extract, and
          activity for these countries.
        </p>
        <div
          className={`mt-2 flex max-h-96 flex-col gap-4 overflow-y-auto rounded-lg border bg-[var(--color-cream-tint)] p-4 ${
            countriesError
              ? "border-[var(--color-coral)]"
              : "border-[var(--color-hairline)]"
          }`}
        >
          {picked.length === 0 ? (
            <p className="text-[13px] text-[var(--color-muted)]">
              Select a project first to list its countries.
            </p>
          ) : (
            picked.map(({ item, project }) => (
              <section key={project.slug} aria-label={`${project.name} countries`}>
                <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]">
                  {project.name}
                </h3>
                {project.countries.length === 0 ? (
                  <p className="mt-2 text-[13px] text-[var(--color-muted)]">
                    This project has no countries yet. Add them in Strategy.
                  </p>
                ) : (
                  <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {project.countries.map((country) => (
                      <label
                        key={`${project.slug}-${country}`}
                        className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-[var(--color-ink)]"
                      >
                        <input
                          type="checkbox"
                          checked={item.countries.includes(country)}
                          onChange={() => onToggleCountry(project.slug, country)}
                          className="rounded outline-none"
                          aria-label={`Allow access to ${country} in ${project.name}`}
                        />
                        <CountryFlag country={country} className="h-5 w-7" />
                        <span>{country}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
        <AdminFieldError id="create-op-countries-error" message={countriesError} />
      </fieldset>
    </div>
  );
}
