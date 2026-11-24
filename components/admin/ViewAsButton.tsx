"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { Eye } from "lucide-react";
import { startViewAs } from "@/actions/view-as";

/** Admin / HOD: open Orbit as this person, read only. */
export function ViewAsButton({ userId, name }: { userId: number; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`See Orbit exactly as ${name} sees it. Read only: nothing can be changed.`}
      onClick={() =>
        startTransition(async () => {
          const result = await startViewAs(userId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          window.location.assign("/");
        })
      }
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-hairline)] px-3 py-1 text-[12px] font-semibold text-[var(--color-ink)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:opacity-60"
    >
      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      {pending ? "Opening…" : "View as"}
    </button>
  );
}
