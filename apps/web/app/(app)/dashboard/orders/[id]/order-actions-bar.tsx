"use client";

import { useState, useTransition } from "react";
import { Check, X, Link2 } from "lucide-react";

import { cancelOrderAction, markOrderPaidAction, sendPaymentLinkAction } from "../actions";

export function OrderActionsBar({ orderId }: { orderId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [confirmKind, setConfirmKind] = useState<"paid" | "cancel" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [linkResult, setLinkResult] = useState<{ sent: boolean; url: string } | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [copied, setCopied] = useState(false);

  function sendPaymentLink() {
    setError(null);
    setLinkResult(null);
    setLinkPending(true);
    startTransition(async () => {
      const result = await sendPaymentLinkAction(orderId);
      setLinkPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLinkResult({ sent: result.sent, url: result.url });
    });
  }

  async function copyLink() {
    if (!linkResult) return;
    try {
      await navigator.clipboard.writeText(linkResult.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; the URL is shown for manual copy.
    }
  }

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
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
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
    <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
      <h3 className="text-base font-medium text-foreground">Actions</h3>
      <p className="mt-2 text-sm text-text-secondary">This order is still pending. Mark as paid when payment is received, or cancel if it falls through.</p>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      {linkResult ? (
        <div className="mt-4 rounded-xl bg-brand-soft px-4 py-3 ring-1 ring-brand-primary/20">
          <p className="text-sm font-medium text-foreground">
            {linkResult.sent
              ? "Payment link sent to the customer's WhatsApp."
              : "Payment link ready to share."}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {linkResult.sent
              ? "If they don't receive it (WhatsApp only delivers within 24h of their last message), copy and send it yourself."
              : "Copy this link and send it to your customer."}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={linkResult.url}
              className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-text-secondary ring-1 ring-black/[0.06]"
            />
            <button type="button" onClick={copyLink} className="shrink-0 rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-foreground/90">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={sendPaymentLink} disabled={linkPending} className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50">
          <Link2 size={14} strokeWidth={2.5} />
          {linkPending ? "Generating..." : "Send payment link"}
        </button>
        <button type="button" onClick={() => requestConfirm("paid")} className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
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
