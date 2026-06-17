"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

import { Label } from "@/components/ui/label";
import { formatNairaFromKobo } from "@/lib/format";

import { createOrderAction, type CreateOrderState } from "../actions";

type Customer = { id: string; name: string; phone_e164: string };
type Product = { id: string; name: string; price_kobo: number; stock_quantity: number };

type LineItem = {
  uid: string;
  product_id: string;
  quantity: number;
};

const initialState: CreateOrderState = { status: "idle", error: null, fieldErrors: {} };

function newUid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function OrderForm(props: { customers: Customer[]; products: Product[] }) {
  const customers = props.customers;
  const products = props.products;

  const [state, formAction, isPending] = useActionState(createOrderAction, initialState);

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<LineItem[]>([{ uid: newUid(), product_id: "", quantity: 1 }]);
  const [notes, setNotes] = useState<string>("");

  const productsById = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const subtotalKobo = useMemo(() => {
    let total = 0;
    for (const item of items) {
      const product = productsById.get(item.product_id);
      if (!product) continue;
      total += product.price_kobo * item.quantity;
    }
    return total;
  }, [items, productsById]);

  function updateItem(uid: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { uid: newUid(), product_id: "", quantity: 1 }]);
  }

  function removeItem(uid: string) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.uid !== uid)));
  }

  const itemsForSubmit = items
    .filter((it) => it.product_id && it.quantity > 0)
    .map((it) => ({ product_id: it.product_id, quantity: it.quantity }));

  const canSubmit = customerId !== "" && itemsForSubmit.length > 0;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="items" value={JSON.stringify(itemsForSubmit)} />
      <input type="hidden" name="notes" value={notes} />

      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-base font-medium text-foreground">Customer</h2>
        <div className="mt-5">
          <Label htmlFor="customer-select">Pick a customer</Label>
          <select id="customer-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" aria-invalid={Boolean(state.fieldErrors?.customer_id)}>
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {state.fieldErrors?.customer_id ? (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.customer_id}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">Items</h2>
          <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted/70">
            <Plus size={12} strokeWidth={2.5} />
            Add item
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {items.map((item) => {
            const selected = productsById.get(item.product_id);
            const lineTotal = selected ? selected.price_kobo * item.quantity : 0;
            const canRemove = items.length > 1;
            return (
              <div key={item.uid} className="rounded-2xl bg-surface-muted/40 p-3 ring-1 ring-black/[0.03]">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <select value={item.product_id} onChange={(e) => updateItem(item.uid, { product_id: e.target.value })} className="w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-foreground ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-primary/30">
                      <option value="">Pick product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name + " - " + formatNairaFromKobo(p.price_kobo)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={"qty-" + item.uid} className="text-xs text-text-muted">Qty</Label>
                      <input id={"qty-" + item.uid} type="number" min={1} max={9999} value={item.quantity} onChange={(e) => updateItem(item.uid, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="w-20 rounded-lg border-0 bg-white px-3 py-1.5 text-sm tabular-nums text-foreground ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-primary/30" />
                      {selected ? (
                        <p className="ml-auto text-sm font-medium tabular-nums text-foreground">{formatNairaFromKobo(lineTotal)}</p>
                      ) : null}
                    </div>
                  </div>
                  {canRemove ? (
                    <button type="button" onClick={() => removeItem(item.uid)} aria-label="Remove item" className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-text-muted ring-1 ring-black/[0.06] transition-colors hover:bg-red-50 hover:text-red-600">
                      <X size={14} strokeWidth={2} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {state.fieldErrors?.items ? (
          <p className="mt-3 text-xs text-red-600">{state.fieldErrors.items}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-t border-black/[0.04] pt-4">
          <p className="text-sm font-medium text-text-secondary">Subtotal</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatNairaFromKobo(subtotalKobo)}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <Label htmlFor="notes">Notes <span className="font-normal text-text-muted">(optional)</span></Label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3} placeholder="Special instructions, delivery address, etc." className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" />
      </section>

      {state.status === "error" && state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{state.error}</div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/dashboard/orders" className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground">Cancel</Link>
        <button type="submit" disabled={isPending || !canSubmit} className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? "Capturing..." : "Capture order"}
        </button>
      </div>
    </form>
  );
}
