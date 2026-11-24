"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getExtraAccountHolders } from "@/actions/extra-accounts";
import { ExtraAccountsDialog } from "@/components/admin/ExtraAccountsDialog";
import type { ExtraAccountHolder } from "@/types/admin";

/** Navbar "Extra": loads in the background so pages stay fast. */
export function AdminHeaderExtraButton() {
  const [open, setOpen] = useState(false);
  const [holders, setHolders] = useState<ExtraAccountHolder[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExtraAccountHolders().then(
      (list) => !cancelled && setHolders(list),
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
        onClick={() => setOpen(true)}
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
