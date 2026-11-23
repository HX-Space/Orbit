"use client";

import { useState, useTransition } from "react";
import { setAdminAccountPlace } from "@/actions/shared-employees";
import type { AccountPlaceInfo } from "@/types/admin";

/** Which of a shared employee's places this account counts for. */
export function AccountPlaceSelect({
  accountId,
  place,
  readOnly = false,
  onChanged,
}: {
  accountId: number;
  place: AccountPlaceInfo;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const [value, setValue] = useState(place.key);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const current = place.options.find((option) => option.key === value);

  if (readOnly || !place.canChange) {
    return (
      <span className="text-[12px] font-medium text-[var(--color-muted)]">
        Counts for {current?.label ?? "home"}
      </span>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-[var(--color-muted)]">
      <select
        value={value}
        disabled={pending}
        aria-label="Project and country this account counts for"
        onChange={(e) => {
          const next = place.options.find((option) => option.key === e.target.value);
          if (!next) return;
          const previous = value;
          setValue(next.key);
          setError(null);
          startTransition(async () => {
            const result = await setAdminAccountPlace(accountId, {
              region: next.region,
              country: next.country,
            });
            if (result.error) {
              setValue(previous);
              setError(result.error);
              return;
            }
            onChanged?.();
          });
        }}
        className="cursor-pointer rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-2 py-1 text-[12px] text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:opacity-60"
      >
        {place.options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[var(--color-coral)]">{error}</span> : null}
    </label>
  );
}
