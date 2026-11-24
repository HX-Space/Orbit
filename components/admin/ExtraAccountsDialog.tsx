"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { CountryFlag } from "@/lib/country-icons";
import type { ExtraAccountHolder } from "@/types/admin";

type Filters = { project: string; country: string; manager: string; platform: string };
const EMPTY: Filters = { project: "", country: "", manager: "", platform: "" };
const NO_MANAGER = "__none__";

const fieldClass =
  "h-11 cursor-pointer rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 text-[14px] font-medium text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]";

function sorted(values: Iterable<string>) {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Same window as Spare: people holding more accounts than their slot, with filters. */
export function ExtraAccountsDialog({
  holders,
  onClose,
}: {
  holders: ExtraAccountHolder[] | null;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const list = useMemo(() => holders ?? [], [holders]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const options = useMemo(
    () => ({
      projects: sorted(list.map((h) => h.project)),
      countries: sorted(list.map((h) => h.country)),
      managers: sorted(list.map((h) => h.countryManager ?? "")),
      platforms: sorted(list.flatMap((h) => h.platforms.map((p) => p.label))),
      anyWithoutManager: list.some((h) => !h.countryManager),
    }),
    [list]
  );

  const filtered = list.filter(
    (h) =>
      (!filters.project || h.project === filters.project) &&
      (!filters.country || h.country === filters.country) &&
      (!filters.manager ||
        (filters.manager === NO_MANAGER ? !h.countryManager : h.countryManager === filters.manager)) &&
      (!filters.platform || h.platforms.some((p) => p.label === filters.platform))
  );
  const active = Object.values(filters).some(Boolean);
  const extraAccounts = filtered.reduce((sum, h) => sum + h.extraTotal, 0);

  const select = (
    key: keyof Filters,
    label: string,
    all: string,
    values: string[],
    extra?: { value: string; label: string }
  ) => (
    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-semibold text-[var(--color-muted)]">
      {label}
      <select
        value={filters[key]}
        aria-label={`Filter extra accounts by ${label.toLowerCase()}`}
        onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}
        className={fieldClass}
      >
        <option value="">{all}</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
        {extra ? <option value={extra.value}>{extra.label}</option> : null}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" role="presentation">
      <motion.button
        type="button"
        aria-label="Close extra accounts dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="extra-accounts-modal-title"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] bg-[var(--color-surface)] shadow-xl sm:max-h-[calc(100vh-4rem)]"
      >
        <div className="shrink-0 border-b border-[var(--color-hairline)] px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="extra-accounts-modal-title"
                className="text-[22px] font-extrabold text-[var(--color-ink)] sm:text-[26px]"
              >
                Extra accounts
              </h2>
              <p className="mt-1 text-[14px] text-[var(--color-muted)]">
                People holding more active accounts on a platform than their planned slot. They are
                counted in Accounts and sent to Google Sheets.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close extra accounts"
              onClick={onClose}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
            >
              <X className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
            </button>
          </div>

          <p className="mt-4 inline-flex rounded-lg bg-[var(--color-ink)] px-3 py-2 text-[13px] font-semibold text-[var(--color-surface)]">
            {holders === null
              ? "Loading…"
              : `${active ? `${filtered.length} of ${list.length}` : list.length} ${
                  list.length === 1 ? "person" : "people"
                } · ${extraAccounts} extra ${extraAccounts === 1 ? "account" : "accounts"}`}
          </p>

          <section aria-label="Extra account filters" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {select("project", "Project", "All projects", options.projects)}
            {select("country", "Country", "All countries", options.countries)}
            {select(
              "manager",
              "Country Manager",
              "All Country Managers",
              options.managers,
              options.anyWithoutManager ? { value: NO_MANAGER, label: "No Country Manager" } : undefined
            )}
            {select("platform", "Platform", "All platforms", options.platforms)}
          </section>
          {active ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="mt-3 cursor-pointer text-[13px] font-semibold text-[var(--color-emerald)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:pb-6">
          {holders === null ? (
            <p className="inline-flex items-center gap-2 py-8 text-[14px] font-semibold text-[var(--color-muted)]">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--color-emerald)]" aria-hidden="true" />
              Loading extra accounts…
            </p>
          ) : filtered.length === 0 ? (
            <p className="rounded-lg bg-[var(--color-cream-tint)] px-4 py-6 text-center text-[14px] text-[var(--color-muted)]">
              {list.length === 0 ? "Nobody holds more accounts than their slot." : "Nobody matches these filters."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[var(--color-hairline)]">
              <table className="w-full min-w-[720px] text-left text-[13px]">
                <thead className="bg-[var(--color-cream-tint)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-2.5">Account holder</th>
                    <th className="px-4 py-2.5">Project</th>
                    <th className="px-4 py-2.5">Country</th>
                    <th className="px-4 py-2.5">Country Manager</th>
                    <th className="px-4 py-2.5">Platforms above the slot</th>
                    <th className="px-4 py-2.5 text-right">Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((holder) => (
                    <tr
                      key={`${holder.source}-${holder.id}-${holder.country}`}
                      className="border-t border-[var(--color-hairline)] align-top"
                    >
                      <td className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">{holder.name}</td>
                      <td className="px-4 py-2.5 text-[var(--color-ink)]">{holder.project}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                          <CountryFlag country={holder.country} title={holder.country} className="h-4 w-6" />
                          {holder.country}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--color-ink)]">{holder.countryManager ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {holder.platforms.map((platform) => (
                            <span
                              key={platform.label}
                              className="rounded-full bg-[var(--color-cream-tint)] px-2.5 py-1 text-[12px] text-[var(--color-ink)]"
                              title={`${platform.actual} accounts, slot is ${platform.target}`}
                            >
                              {platform.label}: {platform.actual} / {platform.target}{" "}
                              <span className="font-semibold text-[var(--color-coral)]">+{platform.extra}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold tabular-nums text-[var(--color-coral)]">
                        +{holder.extraTotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
