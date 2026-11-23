"use client";

import { Plus, X } from "lucide-react";
import { regionDisplayLabel } from "@/lib/project-labels";
import {
  isBuiltInSetupRegion,
  setupCountriesForRegion,
  type SetupRegion,
} from "@/lib/setup-options";
import type { EmployeeCreateProjectOption, SharedPlace } from "@/types/admin";

const PROJECT_REGIONS: SetupRegion[] = ["Africa", "Europe", "Alphaa", "Asia"];

/** "Shared employee" toggle + the extra projects / countries they work in. */
export function SharedEmployeeFields({
  isShared,
  places,
  projects,
  onChange,
  fieldClass,
}: {
  isShared: boolean;
  places: SharedPlace[];
  projects: EmployeeCreateProjectOption[];
  onChange: (next: { isShared: boolean; places: SharedPlace[] }) => void;
  fieldClass: string;
}) {
  const projectOptions = [
    ...PROJECT_REGIONS.map((region) => ({
      value: region as string,
      label: regionDisplayLabel(region),
    })),
    ...projects
      .filter((project) => !isBuiltInSetupRegion(project.region))
      .map((project) => ({ value: project.region, label: project.name })),
  ];

  function setPlace(index: number, next: SharedPlace) {
    onChange({ isShared, places: places.map((place, i) => (i === index ? next : place)) });
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-[var(--color-hairline)] p-4 sm:col-span-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={isShared}
          onChange={(e) =>
            onChange({
              isShared: e.target.checked,
              places:
                e.target.checked && places.length === 0
                  ? [{ region: "", country: "" }]
                  : places,
            })
          }
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-emerald)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-[var(--color-ink)]">
            Shared employee
          </span>
          <span className="text-[12px] font-medium text-[var(--color-muted)]">
            Works in more than one project or country and holds accounts in each.
            They count as a person in their home project; each account counts
            where it is assigned.
          </span>
        </span>
      </label>

      {isShared ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-[var(--color-muted)]">Also works in</p>
          {places.map((place, index) => {
            const countries = place.region
              ? setupCountriesForRegion(place.region as SetupRegion, projects)
              : [];
            return (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <select
                  value={place.region}
                  onChange={(e) => setPlace(index, { region: e.target.value, country: "" })}
                  aria-label={`Extra project ${index + 1}`}
                  className={`min-w-[150px] flex-1 cursor-pointer ${fieldClass}`}
                >
                  <option value="">Select a project</option>
                  {projectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={place.country}
                  disabled={!place.region}
                  onChange={(e) => setPlace(index, { ...place, country: e.target.value })}
                  aria-label={`Extra country ${index + 1}`}
                  className={`min-w-[150px] flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${fieldClass}`}
                >
                  <option value="">Select a country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`Remove extra place ${index + 1}`}
                  onClick={() =>
                    onChange({ isShared, places: places.filter((_, i) => i !== index) })
                  }
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => onChange({ isShared, places: [...places, { region: "", country: "" }] })}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-[var(--color-emerald)] outline-none hover:bg-[var(--color-emerald-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
            Add another place
          </button>
        </div>
      ) : null}
    </fieldset>
  );
}
