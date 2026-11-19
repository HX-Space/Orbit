"use client";

import { useMemo } from "react";
import { managersForProjectAndCountry } from "@/lib/admin-view";
import { ROLE_LABELS } from "@/lib/role-hierarchy";
import type { EmployeeReportingFieldsProps } from "@/types/admin";

function managerLabel(
  fullName: string,
  countries: string[]
): string {
  return countries.length ? `${fullName} (${countries.join(", ")})` : fullName;
}

export function EmployeeReportingFields({
  value,
  onChange,
  teamLeads,
  managers,
  country,
  region,
  disabled = false,
  managerError,
  managerErrorId,
  fieldClass,
  invalidFieldClass,
}: EmployeeReportingFieldsProps) {
  const managerOptions = useMemo(() => {
    const options = managersForProjectAndCountry(managers, region, country);
    if (value.managerId && !options.some((manager) => manager.id === value.managerId)) {
      const selected = managers.find((manager) => manager.id === value.managerId);
      return selected ? [selected, ...options] : options;
    }
    return options;
  }, [country, region, managers, value.managerId]);

  // The Team Leader picker was removed; an existing Team Leader link is kept,
  // and cleared only when the new Country Manager isn't that Team Leader's.
  function handleManagerChange(nextManagerId: number | null) {
    const selectedTeamLead = teamLeads.find(
      (teamLead) => teamLead.id === value.teamLeadId
    );
    const teamLeadConflicts =
      Boolean(selectedTeamLead?.manager_id) &&
      nextManagerId != null &&
      selectedTeamLead?.manager_id !== nextManagerId;

    onChange({
      managerId: nextManagerId,
      teamLeadId: teamLeadConflicts ? null : value.teamLeadId,
    });
  }

  return (
    <>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--color-muted)]">
        {ROLE_LABELS.manager} (optional)
        <select
          disabled={disabled}
          value={value.managerId ?? ""}
          onChange={(e) =>
            handleManagerChange(e.target.value ? Number(e.target.value) : null)
          }
          aria-label={`Assign ${ROLE_LABELS.manager} (optional)`}
          aria-invalid={Boolean(managerError)}
          aria-describedby={managerError ? managerErrorId : undefined}
          className={`cursor-pointer rounded outline-none ${fieldClass} ${
            managerError ? invalidFieldClass : ""
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <option value="">{`No ${ROLE_LABELS.manager}`}</option>
          {managerOptions.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {managerLabel(manager.full_name, manager.countries)}
            </option>
          ))}
        </select>
        {managerError ? (
          <span
            id={managerErrorId}
            className="text-[12px] font-medium text-[var(--color-coral)]"
          >
            {managerError}
          </span>
        ) : null}
      </label>
    </>
  );
}
