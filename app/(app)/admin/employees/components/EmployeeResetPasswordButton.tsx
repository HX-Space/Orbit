"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import toast from "react-hot-toast";
import { resetEmployeePassword } from "@/actions/admin";
import type { EmployeeResetPasswordButtonProps } from "@/types/admin";

export function EmployeeResetPasswordButton({
  userId,
  fullName,
  source,
}: EmployeeResetPasswordButtonProps) {
  const [open, setOpen] = useState(false);

  if (source !== "temp") return null;

  return (
    <>
      <motion.button
        type="button"
        layout
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Reset password for ${fullName}`}
        title="Reset password"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-ink)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
      </motion.button>
      <AnimatePresence>
        {open ? (
          <ResetPasswordDialog
            userId={userId}
            fullName={fullName}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ResetPasswordDialog({
  userId,
  fullName,
  onClose,
}: {
  userId: number;
  fullName: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const tooShort = password.length < 8;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await resetEmployeePassword(userId, password);
        toast.success(`Temporary password set for ${fullName}.`);
        onClose();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not reset the password.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      role="presentation"
    >
      <motion.button
        type="button"
        aria-label="Close reset password"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-password-title"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="relative z-10 my-4 w-full max-w-lg rounded-[20px] bg-[var(--color-surface)] p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="reset-password-title"
              className="text-[22px] font-extrabold text-[var(--color-ink)] sm:text-[26px]"
            >
              Reset password
            </h2>
            <p className="mt-1 text-[14px] text-[var(--color-muted)]">
              {fullName} must change it after signing in.
            </p>
          </div>
          <motion.button
            type="button"
            aria-label="Close reset password"
            layout
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </motion.button>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg bg-[var(--color-coral-tint)] px-4 py-3 text-[14px] text-[var(--color-coral)]">
            {error}
          </p>
        ) : null}

        <label className="mt-5 flex flex-col gap-1.5 text-[13px] font-semibold text-[var(--color-muted)]">
          Temporary password
          <div className="relative">
            <input
              type={visible ? "text" : "password"}
              value={password}
              autoComplete="new-password"
              aria-label="Temporary password"
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !tooShort && !pending) submit();
              }}
              className="w-full cursor-text rounded border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 pr-10 text-[14px] font-medium text-[var(--color-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((v) => !v)}
              className="absolute inset-y-0 right-0 inline-flex w-10 cursor-pointer items-center justify-center text-[var(--color-muted)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)]"
            >
              {visible ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <span className="font-normal">At least 8 characters.</span>
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <motion.button
            type="button"
            layout
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={pending}
            onClick={onClose}
            aria-label="Cancel password reset"
            className="cursor-pointer rounded-lg border border-[var(--color-hairline)] px-4 py-2 text-[13px] font-semibold text-[var(--color-ink)] outline-none hover:bg-[var(--color-cream-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:opacity-50"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            layout
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={pending || tooShort}
            onClick={submit}
            aria-label="Set temporary password"
            className="cursor-pointer rounded-lg bg-[var(--color-emerald)] px-4 py-2 text-[13px] font-semibold text-white outline-none hover:bg-[var(--color-emerald-hover)] focus-visible:ring-2 focus-visible:ring-[var(--color-emerald)] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Set password"}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
