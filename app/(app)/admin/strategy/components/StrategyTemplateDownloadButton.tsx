"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Download } from "lucide-react";

const TABS = ["Main", "Africa", "Europe", "Asia"] as const;
type Tab = (typeof TABS)[number];

/** Download the client's Alpha Strategy template filled with the plan, for the picked projects. */
export function StrategyTemplateDownloadButton() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Tab[]>([...TABS]);
  const boxRef = useRef<HTMLDivElement>(null);
  const allPicked = picked.length === TABS.length;

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !boxRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function toggle(tab: Tab) {
    setPicked((current) =>
      current.includes(tab) ? current.filter((item) => item !== tab) : TABS.filter((item) => item === tab || current.includes(item))
    );
  }

  const href = `/api/admin/strategy/template?tabs=${allPicked ? "all" : picked.join(",")}`;

  return (
    <div ref={boxRef} className="relative">
      <motion.button
        type="button"
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-semibold text-[var(--color-ink)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Download strategy
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </motion.button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose which projects to download"
          className="absolute left-0 z-20 mt-2 w-60 lg:left-auto lg:right-0 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-3 shadow-lg"
        >
          <p className="px-1 pb-2 text-[12px] font-semibold text-[var(--color-muted)]">
            Which strategy do you want?
          </p>
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[13px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-cream-tint)]">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? [] : [...TABS])}
              className="h-4 w-4 cursor-pointer accent-[var(--color-emerald)]"
            />
            All projects
          </label>
          <div className="my-1 border-t border-[var(--color-hairline)]" />
          {TABS.map((tab) => (
            <label
              key={tab}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-[13px] text-[var(--color-ink)] hover:bg-[var(--color-cream-tint)]"
            >
              <input
                type="checkbox"
                checked={picked.includes(tab)}
                onChange={() => toggle(tab)}
                className="h-4 w-4 cursor-pointer accent-[var(--color-emerald)]"
              />
              {tab}
            </label>
          ))}
          <p className="px-1 pt-1 text-[11px] text-[var(--color-muted)]">
            Africa 2 and Europe 2 are included in Africa and Europe.
          </p>
          <a
            href={picked.length > 0 ? href : undefined}
            aria-disabled={picked.length === 0}
            onClick={() => picked.length > 0 && setOpen(false)}
            className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] ${
              picked.length > 0
                ? "cursor-pointer bg-[var(--color-emerald)] hover:bg-[var(--color-emerald-hover)]"
                : "pointer-events-none cursor-not-allowed bg-[var(--color-emerald)] opacity-50"
            }`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download .xlsx
          </a>
        </div>
      ) : null}
    </div>
  );
}
