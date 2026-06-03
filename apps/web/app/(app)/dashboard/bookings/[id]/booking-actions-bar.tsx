"use client";

import { useState, useTransition } from "react";
import { Check, X, CheckCheck } from "lucide-react";

import type { BookingStatus } from "@/lib/bookings";
import {
  confirmBookingAction,
  completeBookingAction,
  cancelBookingAction,
} from "../actions";

type ConfirmKind = "confirm" | "complete" | "cancel";

export function BookingActionsBar({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestConfirm(kind: ConfirmKind) {
    setError(null);
    setConfirmKind(kind);
  }

  function confirmAction() {
    if (!confirmKind) return;
    const action =
      confirmKind === "confirm"
        ? confirmBookingAction
        : confirmKind === "complete"
          ? completeBookingAction
          : cancelBookingAction;
    startTransition(async () => {
      const result = await action(bookingId);
      if (!result.ok) {
        setError(result.error);
        setConfirmKind(null);
        return;
      }
      setConfirmKind(null);
    });
  }

  if (confirmKind) {
    const copy: Record<ConfirmKind, { title: string; body: string; label: string; danger: boolean }> = {
      confirm: {
        title: "Confirm this booking?",
        body: "This marks the appointment as confirmed.",
        label: "Yes, confirm",
        danger: false,
      },
      complete: {
        title: "Mark this booking completed?",
        body: "This marks the appointment as done.",
        label: "Yes, mark completed",
        danger: false,
      },
      cancel: {
        title: "Cancel this booking?",
        body: "This marks the appointment as cancelled. This can't be undone.",
        label: "Yes, cancel",
        danger: true,
      },
    };
    const c = copy[confirmKind];
    const confirmClass = c.danger
      ? "inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      : "inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50";

    return (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h3 className="text-base font-medium text-foreground">{c.title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{c.body}</p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmKind(null)}
            disabled={isPending}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-50"
          >
            Back
          </button>
          <button type="button" onClick={confirmAction} disabled={isPending} className={confirmClass}>
            {isPending ? "Working..." : c.label}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <h3 className="text-base font-medium text-foreground">Actions</h3>
      <p className="mt-2 text-sm text-text-secondary">
        {status === "pending"
          ? "Confirm this appointment, or cancel it."
          : "Mark this appointment completed once done, or cancel it."}
      </p>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {status === "pending" ? (
          <button
            type="button"
            onClick={() => requestConfirm("confirm")}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <Check size={14} strokeWidth={2.5} />
            Confirm
          </button>
        ) : null}
        {status === "confirmed" ? (
          <button
            type="button"
            onClick={() => requestConfirm("complete")}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <CheckCheck size={14} strokeWidth={2.5} />
            Mark completed
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => requestConfirm("cancel")}
          className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70"
        >
          <X size={14} strokeWidth={2.5} />
          Cancel booking
        </button>
      </div>
    </section>
  );
}
