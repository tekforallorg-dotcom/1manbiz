"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import { cancelOrderAction, markOrderPaidAction } from "../actions";

export function OrderActionsBar({ orderId }: { orderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"paid" | "cancel" | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestConfirm(kind: "paid" | "cancel") {
    setError(null);
    setConfirmKind(kind);
  }

  function dismiss() {
    setConfirmKind(null);
  }

  function confirmAction() {
    if (!confirmKind) return;
    const action = confirmKind === "paid" ? markOrderPaidAction : cancelOrderAction;
    startTransition(async () => {
      const result = await action(orderId);
      if (!result.ok) {
        setError(result.error);
        setConfirmKind(null);
        return;
      }
      setConfirmKind(null);
    });
  }

  if (confirmKind) {
    const isCancel = confirmKind === "cancel";
    const title = isCancel ? "Cancel this order?" : "Mark this order as paid?";
    const body = isCancel
      ? "This will mark the order as cancelled. It will not appear in revenue totals."
      : "This will record payment received, update your customer's total spend, and add to today's revenue.";
    const confirmLabel = isCancel ? "Yes, cancel" : "Yes, mark paid";
    const confirmClass = isCancel
      ? "inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
      : "inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50";

    return (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{body}</p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={dismiss} disabled={isPending} className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-50">
            Back
          </button>
          <button type="button" onClick={confirmAction} disabled={isPending} className={confirmClass}>
            {isPending ? "Working..." : confirmLabel}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <h3 className="text-base font-medium text-foreground">Actions</h3>
      <p className="mt-2 text-sm text-text-secondary">This order is still pending. Mark as paid when payment is received, or cancel if it falls through.</p>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => requestConfirm("paid")} className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark">
          <Check size={14} strokeWidth={2.5} />
          Mark as paid
        </button>
        <button type="button" onClick={() => requestConfirm("cancel")} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
          <X size={14} strokeWidth={2.5} />
          Cancel order
        </button>
      </div>
    </section>
  );
}
