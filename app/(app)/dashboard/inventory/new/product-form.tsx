"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  createProductAction,
  type CreateProductState,
} from "../actions";
import { ImageUpload } from "./image-upload";

const initialState: CreateProductState = { error: null, fieldErrors: {} };

export function ProductForm({ businessId }: { businessId: string }) {
  const [state, formAction, isPending] = useActionState(
    createProductAction,
    initialState,
  );

  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="image_path" value={imagePath ?? ""} />

      {/* Image */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">
          Product image
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Up to 2 MB. JPG, PNG, or WebP. You can change it later.
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

      {/* Details */}
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
              placeholder="e.g. iPhone 15 Pro 256GB"
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
              SKU{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="sku"
              name="sku"
              maxLength={60}
              placeholder="e.g. IP15PRO-256-TIT"
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
              placeholder="A short note customers will see"
              className="mt-1.5 w-full resize-none rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
        </div>
      </section>

      {/* Price + stock */}
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">
          Price & stock
        </h2>

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
                placeholder="0"
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
            <Input
              id="stock_quantity"
              name="stock_quantity"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={0}
              className="mt-1.5 tabular-nums"
              aria-invalid={Boolean(state.fieldErrors?.stock_quantity)}
            />
            {state.fieldErrors?.stock_quantity ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.stock_quantity}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Form-level error */}
      {state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}

      {/* Actions */}
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
          {isPending ? "Adding..." : "Add product"}
        </button>
      </div>
    </form>
  );
}
