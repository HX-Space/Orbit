"use client";

import { useEffect, useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { CountryFlag } from "@/lib/country-icons";
import type { ExtraAccountHolder } from "@/types/admin";

/** KPI tile: people holding more accounts than their slot. Opens the breakdown. */
export function ExtraAccountsKpi({ holders }: { holders: ExtraAccountHolder[] }) {
  const [open, setOpen] = useState(false);
  const extraAccounts = holders.reduce((sum, holder) => sum + holder.extraTotal, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={holders.length === 0}
        aria-label={`Extra accounts: ${holders.length} people, ${extraAccounts} accounts. Show details`}
        className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] bg-[var(--color-surface)] px-3 py-4 text-center outline-none hover:ring-2 hover:ring-[var(--color-emerald-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:cursor-default disabled:hover:ring-0 sm:px-4 sm:py-5"
        style={{ boxShadow: "0 4px 24px rgba(20,20,20,.06)" }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--color-emerald-tint)] text-[var(--color-emerald)]"
          aria-hidden="true"
        >
          <PlusCircle className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <span className="text-[22px] font-extrabold tabular-nums leading-none text-[var(--color-ink)] sm:text-[26px]">
          {holders.length}
        </span>
        <span className="text-[11px] font-medium leading-tight text-[var(--color-muted)] sm:text-[12px]">
          Extra accounts
        </span>
        <span className="text-[11px] text-[var(--color-muted)]">
          {holders.length > 0 ? `People with ${extraAccounts} accounts above their slot` : "Nobody is above their slot"}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" role="presentation">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 cursor-default bg-black/40"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="extra-accounts-title"
            className="relative z-10 my-6 w-full max-w-5xl rounded-[20px] bg-[var(--color-surface)] p-5 shadow-xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="extra-accounts-title" className="text-[22px] font-extrabold text-[var(--color-ink)]">
                  Extra accounts
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                  {holders.length} {holders.length === 1 ? "person holds" : "people hold"} {extraAccounts} active{" "}
                  {extraAccounts === 1 ? "account" : "accounts"} above their planned slot. They are counted in
                  Accounts and sent to Google Sheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close extra accounts"
                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-[12px] border border-[var(--color-hairline)]">
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
                  {holders.map((holder) => (
                    <tr key={`${holder.source}-${holder.id}-${holder.country}`} className="border-t border-[var(--color-hairline)] align-top">
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
          </div>
        </div>
      ) : null}
    </>
  );
}
