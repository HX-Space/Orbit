"use client";

import { CountryFlag } from "@/lib/country-icons";
import type { EmployeeCountryCellProps } from "@/types/admin";

function CountryList({ countries }: { countries: string[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {countries.map((country) => (
        <span
          key={country}
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-[var(--color-ink)]"
        >
          <CountryFlag country={country} title={country} className="h-4 w-6" />
          {country}
        </span>
      ))}
    </div>
  );
}

export function EmployeeCountryCell({ countries, groups }: EmployeeCountryCellProps) {
  // Several projects (an OP with Africa and Africa 2): one bucket per project.
  if (groups && groups.length > 1) {
    return (
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <section key={group.project} aria-label={`${group.project} countries`}>
            <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]">
              {group.project}
            </h4>
            <CountryList countries={group.countries} />
          </section>
        ))}
      </div>
    );
  }

  if (countries.length === 0) {
    return <span className="text-[14px] text-[var(--color-muted)]">—</span>;
  }

  return <CountryList countries={countries} />;
}
