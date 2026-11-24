"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getExtraAccountHolders } from "@/actions/extra-accounts";
import { ExtraAccountsDialog } from "@/components/admin/ExtraAccountsDialog";
import type { ExtraAccountHolder } from "@/types/admin";

const CACHE_KEY = "orbit-extra-accounts";
const CACHE_MS = 10 * 60 * 1000;

function readCache(): ExtraAccountHolder[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { at: number; holders: ExtraAccountHolder[] };
    return Date.now() - saved.at < CACHE_MS ? saved.holders : null;
  } catch {
    return null;
  }
}

function writeCache(holders: ExtraAccountHolder[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), holders }));
  } catch {
    // Storage blocked: the badge just reloads next time.
  }
}

/**
 * Navbar "Extra". The badge comes from a 10-minute browser cache, so moving
 * between pages does not recalculate the whole Overview each time; opening the
 * window always loads fresh data.
 */
export function AdminHeaderExtraButton() {
  const [open, setOpen] = useState(false);
  const [holders, setHolders] = useState<ExtraAccountHolder[] | null>(null);

  function load() {
    return getExtraAccountHolders().then(
      (list) => {
        writeCache(list);
        setHolders(list);
      },
      () => setHolders((current) => current ?? [])
    );
  }

  useEffect(() => {
    let cancelled = false;
    const cached = readCache();
    if (cached) {
      void Promise.resolve(cached).then((list) => !cancelled && setHolders(list));
      return () => {
        cancelled = true;
      };
    }
    getExtraAccountHolders().then(
      (list) => {
        if (cancelled) return;
        writeCache(list);
        setHolders(list);
      },
      () => !cancelled && setHolders([])
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const count = holders?.length ?? 0;
  return (
    <>
      <motion.button
        type="button"
        aria-label={count > 0 ? `View ${count} people with extra accounts` : "View extra accounts"}
        aria-current={open ? "true" : undefined}
        onClick={() => {
          setOpen(true);
          void load();
        }}
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="relative inline-flex h-full shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 text-[14px] font-medium text-[var(--color-muted)] outline-none hover:text-[var(--color-ink)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
      >
        Extra
        {count > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--color-coral)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </motion.button>
      {open ? <ExtraAccountsDialog holders={holders} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
