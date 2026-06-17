"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNairaFromKobo, parseNairaInputToKobo } from "@/lib/format";
import { getProductImageUrl } from "@/lib/storage";

import { createProductAction, type CreateProductState } from "../actions";
import { ImageUpload } from "./image-upload";

const initialState: CreateProductState = { error: null, fieldErrors: {} };

type VariantRow = { label: string; stock: string };

export function ProductForm({ businessId }: { businessId: string }) {
  const [state, formAction, isPending] = useActionState(createProductAction, initialState);

  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Live-preview + variant state.
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [hasVariants, setHasVariants] = useState(false);
  const [optionName, setOptionName] = useState("Color");
  const [rows, setRows] = useState<VariantRow[]>([
    { label: "", stock: "" },
    { label: "", stock: "" },
  ]);

  const addRow = () => setRows((r) => [...r, { label: "", stock: "" }]);
  const removeRow = (i: number) => setRows((r) => (r.length <= 2 ? r : r.filter((_, idx) => idx !== i)));
  const setRow = (i: number, patch: Partial<VariantRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const toInt = (v: string) => {
    const n = Number.parseInt(v || "0", 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };

  const variantTotal = useMemo(() => rows.reduce((sum, r) => sum + toInt(r.stock), 0), [rows]);
  const variantsJson = useMemo(
    () => JSON.stringify(rows.map((r) => ({ label: r.label.trim(), stock: toInt(r.stock) }))),
    [rows],
  );

  // Preview values.
  const previewName = name.trim() || "Product name";
  const previewKobo = price.trim() ? parseNairaInputToKobo(price) : 0;
  const previewPrice = formatNairaFromKobo(previewKobo);
  const previewStock = hasVariants ? variantTotal : toInt(stock);
  const previewLabels = hasVariants ? rows.map((r) => r.label.trim()).filter(Boolean) : [];
  const previewImageUrl = getProductImageUrl(imagePath);

  return (
    <form action={formAction} className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      {/* Hidden fields the server action reads */}
      <input type="hidden" name="image_path" value={imagePath ?? ""} />
      <input type="hidden" name="has_variants" value={hasVariants ? "1" : "0"} />
      <input type="hidden" name="variants_json" value={variantsJson} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Live preview */}
        <aside className="hm-rise order-first lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-[0_20px_50px_-32px_rgba(0,0,0,0.3)]">
            <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Live preview</p>
            <div className="mt-2 overflow-hidden rounded-2xl bg-gradient-to-b from-white to-surface-muted/40 ring-1 ring-black/[0.05]">
              <div className="relative m-2 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-surface-muted/60 via-white to-surface-muted/30 ring-1 ring-black/[0.03]">
                {previewImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={previewImageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-text-muted">
                    <Package size={30} strokeWidth={1.25} />
                  </div>
                )}
                {previewStock === 0 ? (
                  <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-red-600 ring-1 ring-black/[0.04] backdrop-blur-sm">
                    Out of stock
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-1 px-3 pb-3 pt-1">
                <h3 className={"truncate text-sm font-medium " + (name.trim() ? "text-foreground" : "text-text-muted")}>
                  {previewName}
                </h3>
                <div className="mt-auto flex items-baseline justify-between gap-2 pt-1.5">
                  <p className="text-base font-semibold tabular-nums text-brand-primary">{previewPrice}</p>
                  <p className="text-[11px] tabular-nums text-text-muted">
                    {previewStock} {previewStock === 1 ? "unit" : "units"}
                  </p>
                </div>
                {previewLabels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {previewLabels.slice(0, 4).map((l, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-secondary"
                      >
                        {l}
                      </span>
                    ))}
                    {previewLabels.length > 4 ? (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-text-muted">
                        +{previewLabels.length - 4}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-3 px-1 text-[11px] leading-relaxed text-text-muted">
              This is how the product appears in your inventory and catalogue.
            </p>
          </div>
        </aside>

        {/* Form */}
        <div className="order-last space-y-6 lg:order-1">
          {/* Photo */}
          <section className="hm-rise rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
            <h2 className="text-base font-medium text-foreground">Photo</h2>
            <p className="mt-1 text-xs text-text-secondary">Up to 2 MB. JPG, PNG, or WebP. You can change it later.</p>
            <div className="mt-5">
              <ImageUpload
                businessId={businessId}
                currentPath={imagePath}
                onUploaded={(path) => {
                  setImagePath(path);
                  setUploadError(null);
                }}
                onCleared={() => setImagePath(null)}
                onError={setUploadError}
                onUploadingChange={setUploading}
              />
            </div>
            {uploadError ? <p className="mt-3 text-xs text-red-600">{uploadError}</p> : null}
          </section>

          {/* Details */}
          <section className="hm-rise rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8" style={{ animationDelay: "60ms" }}>
            <h2 className="text-base font-medium text-foreground">Details</h2>
            <div className="mt-5 space-y-5">
              <div>
                <Label htmlFor="name">Product name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. iPhone 15 Pro 256GB"
                  className="mt-1.5"
                  aria-invalid={Boolean(state.fieldErrors?.name)}
                />
                {state.fieldErrors?.name ? <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p> : null}
              </div>

              <div>
                <Label htmlFor="sku">
                  SKU <span className="font-normal text-text-muted">(optional)</span>
                </Label>
                <Input id="sku" name="sku" maxLength={60} placeholder="e.g. IP15PRO-256-TIT" className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="description">
                  Description <span className="font-normal text-text-muted">(optional)</span>
                </Label>
                <textarea
                  id="description"
                  name="description"
                  maxLength={1000}
                  rows={3}
                  placeholder="A short note customers will see"
                  className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="hm-rise rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8" style={{ animationDelay: "120ms" }}>
            <h2 className="text-base font-medium text-foreground">{hasVariants ? "Pricing" : "Pricing & stock"}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="price_naira">Price (NGN)</Label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-sm text-text-muted">
                    &#8358;
                  </span>
                  <Input
                    id="price_naira"
                    name="price_naira"
                    type="text"
                    inputMode="decimal"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0"
                    className="pl-8 tabular-nums"
                    aria-invalid={Boolean(state.fieldErrors?.price_naira)}
                  />
                </div>
                {state.fieldErrors?.price_naira ? (
                  <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.price_naira}</p>
                ) : null}
              </div>

              {hasVariants ? (
                <div>
                  <Label>Total stock</Label>
                  <div className="mt-1.5 flex h-[46px] items-center justify-between rounded-xl border border-border bg-surface px-4">
                    <span className="text-sm font-medium tabular-nums text-foreground">{variantTotal}</span>
                    <span className="text-[11px] text-text-muted">from variants</span>
                  </div>
                </div>
              ) : (
                <div>
                  <Label htmlFor="stock_quantity">Stock quantity</Label>
                  <Input
                    id="stock_quantity"
                    name="stock_quantity"
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="mt-1.5 tabular-nums"
                    aria-invalid={Boolean(state.fieldErrors?.stock_quantity)}
                  />
                  {state.fieldErrors?.stock_quantity ? (
                    <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.stock_quantity}</p>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {/* Variants */}
          <section className="hm-rise rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8" style={{ animationDelay: "180ms" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-medium text-foreground">Variants</h2>
                <p className="mt-1 text-xs text-text-secondary">
                  Sell colours, sizes, or storage options under one product. Each shares the price above.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hasVariants}
                aria-label="Enable variants"
                onClick={() => setHasVariants((v) => !v)}
                className={
                  "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
                  (hasVariants ? "bg-brand-primary" : "bg-surface-muted ring-1 ring-black/[0.08]")
                }
              >
                <span
                  className={
                    "inline-block size-5 rounded-full bg-white shadow-sm transition-transform " +
                    (hasVariants ? "translate-x-[22px]" : "translate-x-0.5")
                  }
                />
              </button>
            </div>

            {hasVariants ? (
              <div className="mt-6 space-y-5">
                <div>
                  <Label htmlFor="option_name">Option name</Label>
                  <Input
                    id="option_name"
                    name="option_name"
                    value={optionName}
                    onChange={(e) => setOptionName(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. Color"
                    className="mt-1.5"
                    aria-invalid={Boolean(state.fieldErrors?.option_name)}
                  />
                  {state.fieldErrors?.option_name ? (
                    <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.option_name}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Values</Label>
                    <span className="text-xs tabular-nums text-text-muted">{variantTotal} in stock total</span>
                  </div>
                  {rows.map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={row.label}
                        onChange={(e) => setRow(i, { label: e.target.value })}
                        maxLength={60}
                        placeholder={i === 0 ? "e.g. Black" : i === 1 ? "e.g. White" : "Another value"}
                        aria-label={"Option value " + (i + 1)}
                        className="flex-1"
                      />
                      <Input
                        value={row.stock}
                        onChange={(e) => setRow(i, { stock: e.target.value })}
                        inputMode="numeric"
                        placeholder="Qty"
                        aria-label={"Stock for value " + (i + 1)}
                        className="w-24 tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        disabled={rows.length <= 2}
                        aria-label={"Remove value " + (i + 1)}
                        className="grid size-9 shrink-0 place-items-center rounded-xl text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-muted"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-soft"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    Add value
                  </button>
                  {state.fieldErrors?.variants ? (
                    <p className="text-xs text-red-600">{state.fieldErrors.variants}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {/* Form-level error */}
      {state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{state.error}</div>
      ) : null}

      {/* Sticky action bar */}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-black/[0.05] bg-white/85 px-4 py-3 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.4)] backdrop-blur">
        <Link
          href="/dashboard/inventory"
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || uploading}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add product"}
        </button>
      </div>
    </form>
  );
}
