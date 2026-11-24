"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, PauseCircle, X } from "lucide-react";
import { getOnHoldEmployees } from "@/actions/on-hold";
import { CountryFlag } from "@/lib/country-icons";
import type { OnHoldEmployee } from "@/types/admin";

/** On Hold KPI: click to see who is on hold, with project, CM, OP and platforms. */
export function OnHoldKpi({ count, region }: { count: number; region: string }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<OnHoldEmployee[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getOnHoldEmployees(region).then(
      (list) => !cancelled && setPeople(list),
      () => !cancelled && setError("Could not load the On Hold list.")
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, region]);

  function close() {
    setOpen(false);
    setPeople(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={count === 0}
        aria-label={`On Hold: ${count}. Show who is on hold`}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] bg-[var(--color-surface)] px-3 py-4 text-center outline-none hover:ring-2 hover:ring-[var(--color-emerald-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:cursor-default disabled:hover:ring-0 sm:px-4 sm:py-5"
        style={{ boxShadow: "0 4px 24px rgba(20,20,20,.06)" }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--color-emerald-tint)] text-[var(--color-emerald)]"
          aria-hidden="true"
        >
          <PauseCircle className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <span className="text-[22px] font-extrabold tabular-nums leading-none text-[var(--color-ink)] sm:text-[26px]">
          {count}
        </span>
        <span className="text-[11px] font-medium leading-tight text-[var(--color-muted)] sm:text-[12px]">
          On Hold
        </span>
        <span className="text-[11px] text-[var(--color-muted)]">
          {count > 0 ? "Users with On Hold status · click for details" : "Users with On Hold status"}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8" role="presentation">
          <motion.button
            type="button"
            aria-label="Close On Hold dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50"
            onClick={close}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="on-hold-modal-title"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[20px] bg-[var(--color-surface)] shadow-xl sm:max-h-[calc(100vh-4rem)]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-hairline)] px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <div>
                <h2 id="on-hold-modal-title" className="text-[22px] font-extrabold text-[var(--color-ink)] sm:text-[26px]">
                  On Hold
                </h2>
                <p className="mt-1 text-[14px] text-[var(--color-muted)]">
                  Employees with the On Hold status, who they work with and the accounts they hold.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close On Hold"
                onClick={close}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
              >
                <X className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:pb-6">
              {error ? (
                <p className="text-[14px] text-[var(--color-coral)]">{error}</p>
              ) : people === null ? (
                <p className="inline-flex items-center gap-2 py-8 text-[14px] font-semibold text-[var(--color-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-emerald)]" aria-hidden="true" />
                  Loading who is on hold…
                </p>
              ) : people.length === 0 ? (
                <p className="rounded-lg bg-[var(--color-cream-tint)] px-4 py-6 text-center text-[14px] text-[var(--color-muted)]">
                  Nobody is on hold here.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-[12px] border border-[var(--color-hairline)]">
                  <table className="w-full min-w-[760px] text-left text-[13px]">
                    <thead className="bg-[var(--color-cream-tint)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      <tr>
                        <th className="px-4 py-2.5">Employee</th>
                        <th className="px-4 py-2.5">Project</th>
                        <th className="px-4 py-2.5">Country</th>
                        <th className="px-4 py-2.5">Country Manager</th>
                        <th className="px-4 py-2.5">Operation Manager</th>
                        <th className="px-4 py-2.5">Platforms</th>
                        <th className="px-4 py-2.5 text-right">Accounts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((person) => (
                        <tr key={person.id} className="border-t border-[var(--color-hairline)] align-top">
                          <td className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">{person.name}</td>
                          <td className="px-4 py-2.5 text-[var(--color-ink)]">{person.project}</td>
                          <td className="px-4 py-2.5">
                            {person.country ? (
                              <span className="inline-flex items-center gap-2 text-[var(--color-ink)]">
                                <CountryFlag country={person.country} title={person.country} className="h-4 w-6" />
                                {person.country}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--color-ink)]">{person.countryManager ?? "—"}</td>
                          <td className="px-4 py-2.5 text-[var(--color-ink)]">{person.operationManager ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {person.platforms.length === 0 ? (
                              <span className="text-[var(--color-muted)]">No accounts</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {person.platforms.map((platform) => (
                                  <span
                                    key={platform.label}
                                    className="rounded-full bg-[var(--color-cream-tint)] px-2.5 py-1 text-[12px] text-[var(--color-ink)]"
                                  >
                                    {platform.label}: {platform.count}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-extrabold tabular-nums text-[var(--color-ink)]">
                            {person.totalAccounts}
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
      ) : null}
    </>
  );
}
