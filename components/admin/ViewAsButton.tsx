"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { Loader2, ScanEye } from "lucide-react";
import { startViewAs } from "@/actions/view-as";

/** Admin / HOD: open Orbit as this person, read only. Icon for the row actions. */
export function ViewAsButton({ userId, name }: { userId: number; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`View as ${name} (read only)`}
      title={`View as ${name}: see Orbit exactly as they do. Read only, nothing can be changed.`}
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
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-ink)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" strokeWidth={2} />
      ) : (
        <ScanEye className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
      )}
    </button>
  );
}
