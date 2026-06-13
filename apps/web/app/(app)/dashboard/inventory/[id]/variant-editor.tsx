"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";

import { updateVariantsAction } from "../actions";

type Variant = {
  id: string;
  label: string;
  price_kobo: number | null;
  stock_quantity: number;
  is_active: boolean;
};

type RowState = {
  id: string;
  label: string;
  stock: string;
  price: string; // naira string, blank means inherit the base price
  isActive: boolean;
};

function toRowState(v: Variant): RowState {
  return {
    id: v.id,
    label: v.label,
    stock: String(v.stock_quantity ?? 0),
    price: v.price_kobo === null || v.price_kobo === undefined ? "" : String((v.price_kobo ?? 0) / 100),
    isActive: v.is_active,
  };
}

export function VariantEditor({
  productId,
  basePriceKobo,
  axisLabel,
  variants,
}: {
  productId: string;
  basePriceKobo: number;
  axisLabel: string;
  variants: Variant[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<RowState[]>(() => variants.map(toRowState));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit() {
    setRows(variants.map(toRowState));
    setError(null);
    setEditing(true);
  }

  function setRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const variantStockTotal = variants.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);

  const liveTotal = rows.reduce((sum, r) => {
    const n = parseInt(r.stock, 10);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  function save() {
    setError(null);
    const payloadRows: { id: string; stockQuantity: number; priceKobo: number | null; isActive: boolean }[] = [];
    for (const r of rows) {
      const stockNum = Number(r.stock);
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        setError("Stock for " + r.label + " must be a whole number of 0 or more.");
        return;
      }
      let priceKobo: number | null = null;
      const priceTrim = r.price.trim();
      if (priceTrim !== "") {
        const naira = Number(priceTrim);
        if (!Number.isFinite(naira) || naira < 0) {
          setError("Price for " + r.label + " is not valid.");
          return;
        }
        priceKobo = Math.round(naira * 100);
      }
      payloadRows.push({ id: r.id, stockQuantity: stockNum, priceKobo, isActive: r.isActive });
    }

    startTransition(async () => {
      const res = await updateVariantsAction({ productId, rows: payloadRows });
      if (!res.ok) {
        setError(res.error ?? "Could not save. Please try again.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-medium text-foreground">
            {"Variants" + (axisLabel ? " (" + axisLabel + ")" : "")}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums text-text-muted">
              {variants.length + (variants.length === 1 ? " variant" : " variants") + " - " + variantStockTotal + " in stock"}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-muted/70"
            >
              <Pencil size={13} strokeWidth={2} />
              Edit
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-text-muted">Stock above is the total of these variants.</p>

        <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-black/[0.04]">
          {variants.map((v, idx) => (
            <div
              key={v.id}
              className={"flex items-center justify-between gap-4 bg-white px-4 py-3 " + (idx === 0 ? "" : "border-t border-border")}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{v.label}</p>
                <p className="mt-0.5 text-xs text-text-muted">{v.is_active ? "Active" : "Hidden"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-foreground">
                  {formatNairaFromKobo(v.price_kobo ?? basePriceKobo)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-text-muted">{(v.stock_quantity ?? 0) + " in stock"}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium text-foreground">
          {"Edit variants" + (axisLabel ? " (" + axisLabel + ")" : "")}
        </h2>
        <span className="text-xs tabular-nums text-text-muted">{"Total " + liveTotal + " in stock"}</span>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Leave a price blank to use the product base price. Product stock becomes the total below.
      </p>

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl bg-surface-muted/50 p-4 ring-1 ring-black/[0.04]">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{r.label}</p>
              <button
                type="button"
                onClick={() => setRow(r.id, { isActive: !r.isActive })}
                className={
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors " +
                  (r.isActive
                    ? "bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20"
                    : "bg-surface-muted text-text-muted ring-1 ring-black/[0.06]")
                }
              >
                {r.isActive ? "Active" : "Hidden"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={"stock-" + r.id}
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  Stock
                </label>
                <input
                  id={"stock-" + r.id}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={r.stock}
                  onChange={(e) => setRow(r.id, { stock: e.target.value })}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm tabular-nums text-foreground ring-1 ring-black/[0.06] focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                />
              </div>
              <div>
                <label
                  htmlFor={"price-" + r.id}
                  className="text-[11px] font-medium uppercase tracking-wider text-text-muted"
                >
                  Price (NGN)
                </label>
                <input
                  id={"price-" + r.id}
                  type="text"
                  inputMode="decimal"
                  placeholder={String(basePriceKobo / 100)}
                  value={r.price}
                  onChange={(e) => setRow(r.id, { price: e.target.value })}
                  className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2 text-sm tabular-nums text-foreground ring-1 ring-black/[0.06] placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save variants"}
        </button>
      </div>
    </section>
  );
}
