"use client";

import { useTransition } from "react";
import { Eye, LogOut } from "lucide-react";
import { stopViewAs } from "@/actions/view-as";

/** Shown on every page while an Admin / HOD views Orbit as another person. */
export function ViewAsBanner({
  name,
  roleLabel,
  realName,
}: {
  name: string;
  roleLabel: string;
  realName: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-[var(--color-amber)] px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)]"
    >
      <span className="inline-flex items-center gap-2">
        <Eye className="h-4 w-4" aria-hidden="true" />
        Viewing as {name} ({roleLabel}) · read only, nothing can be changed
        {realName ? <span className="font-medium opacity-80"> · signed in as {realName}</span> : null}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await stopViewAs();
            window.location.assign("/admin/employees");
          })
        }
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-[12px] font-semibold text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        {pending ? "Exiting…" : "Exit view as"}
      </button>
    </div>
  );
}
