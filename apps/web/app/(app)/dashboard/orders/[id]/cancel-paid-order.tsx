"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";

import { cancelOrderAction } from "../actions";

export function CancelPaidOrder({ orderId }: { orderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirmCancel() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h3 className="text-base font-medium text-foreground">Cancel this paid order?</h3>
        <p className="mt-2 text-sm text-text-secondary">
          This returns the items to stock and removes this sale from your revenue and from the customer totals. It does not refund the customer; send any refund to them separately.
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-50">
            Back
          </button>
          <button type="button" onClick={confirmCancel} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50">
            {isPending ? "Working..." : "Yes, cancel order"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <h3 className="text-base font-medium text-foreground">Cancel order</h3>
      <p className="mt-2 text-sm text-text-secondary">Cancelling returns the items to stock and reverses the sale. Refund the customer separately.</p>
      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setError(null); setConfirming(true); }} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
          <X size={14} strokeWidth={2.5} />
          Cancel order
        </button>
      </div>
    </section>
  );
}
