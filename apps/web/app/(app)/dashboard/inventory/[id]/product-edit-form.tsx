"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateProductAction, type UpdateProductState } from "../actions";
import { ImageUpload } from "../new/image-upload";

const initialState: UpdateProductState = { error: null, fieldErrors: {} };

type EditableProduct = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price_kobo: number;
  stock_quantity: number;
  image_path: string | null;
  status: string;
};

export function ProductEditForm({
  product,
  businessId,
  stockManagedByVariants = false,
}: {
  product: EditableProduct;
  businessId: string;
  stockManagedByVariants?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    updateProductAction,
    initialState,
  );

  const [imagePath, setImagePath] = useState<string | null>(product.image_path);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"active" | "archived">(
    product.status === "archived" ? "archived" : "active",
  );

  const priceDefault = String(product.price_kobo / 100);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="image_path" value={imagePath ?? ""} />
      <input type="hidden" name="status" value={status} />

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Product image</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Up to 2 MB. JPG, PNG, or WebP.
        </p>

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

        {uploadError ? (
          <p className="mt-3 text-xs text-red-600">{uploadError}</p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Details</h2>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="name">Product name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={product.name}
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.name}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="sku">
              SKU <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="sku"
              name="sku"
              maxLength={60}
              defaultValue={product.sku ?? ""}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">
              Description{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <textarea
              id="description"
              name="description"
              maxLength={1000}
              rows={3}
              defaultValue={product.description ?? ""}
              className="mt-1.5 w-full resize-none rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Price & stock</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="price_naira">Price (₦)</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-sm text-text-muted">
                ₦
              </span>
              <Input
                id="price_naira"
                name="price_naira"
                type="text"
                inputMode="decimal"
                required
                defaultValue={priceDefault}
                className="pl-8 tabular-nums"
                aria-invalid={Boolean(state.fieldErrors?.price_naira)}
              />
            </div>
            {state.fieldErrors?.price_naira ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.price_naira}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="stock_quantity">Stock quantity</Label>
            {stockManagedByVariants ? (
              <>
                <Input
                  id="stock_quantity"
                  name="stock_quantity"
                  type="number"
                  readOnly
                  value={product.stock_quantity}
                  className="mt-1.5 tabular-nums bg-surface-muted text-text-muted"
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  Total of variant stock. Edit each variant in the Variants section below.
                </p>
              </>
            ) : (
              <>
                <Input
                  id="stock_quantity"
                  name="stock_quantity"
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={product.stock_quantity}
                  className="mt-1.5 tabular-nums"
                  aria-invalid={Boolean(state.fieldErrors?.stock_quantity)}
                />
                {state.fieldErrors?.stock_quantity ? (
                  <p className="mt-1.5 text-xs text-red-600">
                    {state.fieldErrors.stock_quantity}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Status</h2>
        <div className="mt-4 inline-flex rounded-full bg-surface-muted p-1 ring-1 ring-black/[0.06]">
          {(["active", "archived"] as const).map((s) => {
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={
                  "rounded-full px-5 py-1.5 text-sm font-medium transition-colors " +
                  (on
                    ? "bg-white text-foreground ring-1 ring-black/[0.06]"
                    : "text-text-secondary hover:text-foreground")
                }
              >
                {s === "active" ? "Active" : "Archived"}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          {status === "archived"
            ? "Hidden from your catalogue and new orders."
            : "Visible in your catalogue."}
        </p>
      </section>

      {state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/dashboard/inventory"
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending || uploading}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
