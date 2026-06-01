"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";
import type { OrderProposal } from "@/lib/ai/parse-order";

interface Props {
  conversationId: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; proposal: OrderProposal }
  | { kind: "error"; message: string };

export function OrderDraftPanel({ conversationId }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function draft() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/ai/parse-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setState({ kind: "error", message: json.error ?? "Could not draft order" });
        return;
      }
      setState({ kind: "done", proposal: json.proposal as OrderProposal });
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  const total =
    state.kind === "done"
      ? state.proposal.lineItems.reduce((sum, li) => sum + li.unitPriceKobo * li.qty, 0)
      : 0;

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Draft order from chat</p>
          <p className="text-[13px] text-text-muted">
            AI reads this chat and suggests an order. You review before anything is saved.
          </p>
        </div>
        <button
          type="button"
          onClick={draft}
          disabled={state.kind === "loading"}
          className={
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
            (state.kind === "loading"
              ? "bg-surface-muted text-text-muted"
              : "bg-brand-primary text-white hover:opacity-90")
          }
        >
          <Sparkles size={14} strokeWidth={2} />
          {state.kind === "loading" ? "Reading..." : "Draft order"}
        </button>
      </div>

      {state.kind === "error" ? (
        <p className="mt-3 text-[13px] text-red-600">{state.message}</p>
      ) : null}

      {state.kind === "done" && state.proposal.lineItems.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-muted">No orderable items found in this chat yet.</p>
      ) : null}

      {state.kind === "done" && state.proposal.lineItems.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-surface-muted p-3">
          {state.proposal.customerHint ? (
            <p className="mb-2 text-[13px] text-text-secondary">
              Customer:{" "}
              <span className="font-medium text-foreground">
                {state.proposal.customerHint.name ?? state.proposal.customerHint.phone}
              </span>
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {state.proposal.lineItems.map((li, i) => (
              <li
                key={li.productId + ":" + i}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-foreground">
                  {li.name} <span className="text-text-muted">x{li.qty}</span>
                </span>
                <span className="tabular-nums text-foreground">
                  {formatNairaFromKobo(li.unitPriceKobo * li.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] pt-2 text-sm font-semibold">
            <span className="text-foreground">Subtotal</span>
            <span className="tabular-nums text-foreground">{formatNairaFromKobo(total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-text-muted">
            Proposal only. Prices come from your catalog. Confirm-to-create arrives in the next update.
          </p>
        </div>
      ) : null}
    </div>
  );
}
