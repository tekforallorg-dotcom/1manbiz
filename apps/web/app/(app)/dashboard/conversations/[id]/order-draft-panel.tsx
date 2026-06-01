"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Sparkles, Minus, Plus, X } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";
import type { OrderProposal } from "@/lib/ai/parse-order";
import { createOrderFromProposalAction } from "../../orders/actions";

interface Props {
  conversationId: string;
}

type DraftLine = {
  uid: string;
  productId: string;
  name: string;
  qty: number;
  unitPriceKobo: number;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; customerLabel: string | null; notes: string }
  | { kind: "error"; message: string };

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return "dl" + uidSeq;
}

export function OrderDraftPanel({ conversationId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function draft() {
    setState({ kind: "loading" });
    setCreateError(null);
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
      const proposal = json.proposal as OrderProposal;
      setLines(
        proposal.lineItems.map((li) => ({
          uid: nextUid(),
          productId: li.productId,
          name: li.name,
          qty: li.qty,
          unitPriceKobo: li.unitPriceKobo,
        }))
      );
      const hint = proposal.customerHint;
      setState({
        kind: "ready",
        customerLabel: hint ? hint.name ?? hint.phone : null,
        notes: proposal.notes ?? "",
      });
    } catch {
      setState({ kind: "error", message: "Network error" });
    }
  }

  function setQty(uid: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, qty: Math.min(999, Math.max(1, qty)) } : l))
    );
  }

  function removeLine(uid: string) {
    setLines((prev) => prev.filter((l) => l.uid !== uid));
  }

  const subtotalKobo = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPriceKobo * l.qty, 0),
    [lines]
  );

  async function createOrder() {
    if (lines.length === 0 || creating) return;
    setCreating(true);
    setCreateError(null);
    const notes = state.kind === "ready" ? state.notes : "";
    const result = await createOrderFromProposalAction({
      conversationId,
      items: lines.map((l) => ({ productId: l.productId, quantity: l.qty })),
      notes: notes || null,
    });
    if (!result.ok) {
      setCreateError(result.error);
      setCreating(false);
      return;
    }
    router.push("/dashboard/orders/" + result.orderId);
  }

  const ready = state.kind === "ready";

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Draft order from chat</p>
          <p className="text-[13px] text-text-muted">
            AI reads this chat and suggests an order. Review and edit before you create it.
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
          {state.kind === "loading" ? "Reading..." : ready ? "Re-draft" : "Draft order"}
        </button>
      </div>

      {state.kind === "error" ? (
        <p className="mt-3 text-[13px] text-red-600">{state.message}</p>
      ) : null}

      {ready && lines.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-muted">
          No orderable items in this chat. Re-draft after the customer confirms what they want.
        </p>
      ) : null}

      {ready && lines.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-surface-muted p-3">
          {state.customerLabel ? (
            <p className="mb-2 text-[13px] text-text-secondary">
              Customer:{" "}
              <span className="font-medium text-foreground">{state.customerLabel}</span>
            </p>
          ) : null}

          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.uid}
                className="flex items-center justify-between gap-3 rounded-xl bg-white p-2.5 ring-1 ring-black/[0.04]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{l.name}</p>
                  <p className="text-[12px] tabular-nums text-text-muted">
                    {formatNairaFromKobo(l.unitPriceKobo)} each
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center rounded-full ring-1 ring-black/[0.08]">
                    <button
                      type="button"
                      onClick={() => setQty(l.uid, l.qty - 1)}
                      aria-label={"Decrease quantity of " + l.name}
                      className="grid size-7 place-items-center rounded-full text-text-secondary transition-colors hover:text-foreground disabled:opacity-40"
                      disabled={l.qty <= 1}
                    >
                      <Minus size={13} strokeWidth={2.5} />
                    </button>
                    <span className="w-7 text-center text-sm font-medium tabular-nums text-foreground">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(l.uid, l.qty + 1)}
                      aria-label={"Increase quantity of " + l.name}
                      className="grid size-7 place-items-center rounded-full text-text-secondary transition-colors hover:text-foreground"
                    >
                      <Plus size={13} strokeWidth={2.5} />
                    </button>
                  </div>
                  <span className="w-24 text-right text-sm font-medium tabular-nums text-foreground">
                    {formatNairaFromKobo(l.unitPriceKobo * l.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(l.uid)}
                    aria-label={"Remove " + l.name}
                    className="grid size-7 place-items-center rounded-full text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3 text-sm font-semibold">
            <span className="text-foreground">Subtotal</span>
            <span className="tabular-nums text-foreground">{formatNairaFromKobo(subtotalKobo)}</span>
          </div>

          {createError ? (
            <p className="mt-2 text-[13px] text-red-600">{createError}</p>
          ) : null}

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={createOrder}
              disabled={creating || lines.length === 0}
              className={
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors " +
                (creating || lines.length === 0
                  ? "bg-surface-muted text-text-muted"
                  : "bg-foreground text-white hover:bg-foreground/90")
              }
            >
              {creating ? "Creating..." : "Create order"}
            </button>
          </div>

          <p className="mt-2 text-[11px] text-text-muted">
            Creates a pending (unpaid) order. Prices come from your catalog. You confirm payment later.
          </p>
        </div>
      ) : null}
    </div>
  );
}
