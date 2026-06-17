"use client";

import { useActionState, useState } from "react";
import { Notice } from "@/components/notice";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateSlug } from "@/lib/slug";

import {
  updateBusinessSettingsAction,
  type UpdateBusinessSettingsState,
} from "./actions";
import { LogoUpload } from "./logo-upload";

const initialState: UpdateBusinessSettingsState = {
  status: "idle",
  error: null,
  fieldErrors: {},
};

type Business = {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  whatsapp_number: string | null;
  logo_path: string | null;
  catalogue_active: boolean;
  address: string | null;
  fulfillment_mode: string;
};

export function BusinessSettingsForm({ business }: { business: Business }) {
  const [state, formAction, isPending] = useActionState(
    updateBusinessSettingsAction,
    initialState,
  );

  const [logoPath, setLogoPath] = useState<string | null>(business.logo_path);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [slugValue, setSlugValue] = useState(business.slug);
  const [slugClientError, setSlugClientError] = useState<string | null>(null);
  const [fulfillmentMode, setFulfillmentMode] = useState(
    business.fulfillment_mode ?? "both",
  );
  const pickupEnabled =
    fulfillmentMode === "pickup" || fulfillmentMode === "both";

  function onSlugChange(value: string) {
    setSlugValue(value);
    if (value === business.slug) {
      setSlugClientError(null);
      return;
    }
    setSlugClientError(validateSlug(value));
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="logo_path" value={logoPath ?? ""} />

      {/* Logo */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-base font-medium text-foreground">Logo</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Up to 1 MB. JPG, PNG, or WebP. Square images look best.
        </p>
        <div className="mt-5">
          <LogoUpload
            businessId={business.id}
            currentPath={logoPath}
            onUploaded={(path) => {
              setLogoPath(path);
              setUploadError(null);
            }}
            onCleared={() => setLogoPath(null)}
            onError={setUploadError}
            onUploadingChange={setUploading}
          />
        </div>
        {uploadError ? (
          <p className="mt-3 text-xs text-red-600">{uploadError}</p>
        ) : null}
      </section>

      {/* Profile */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-base font-medium text-foreground">
          Business profile
        </h2>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={business.name}
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
            <Label htmlFor="tagline">
              Tagline{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="tagline"
              name="tagline"
              maxLength={200}
              defaultValue={business.tagline ?? ""}
              placeholder="e.g. Premium phones and accessories"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Shown under your business name on the public catalogue.
            </p>
          </div>

          <div>
            <Label htmlFor="slug">Public URL handle</Label>
            <div className="mt-1.5 flex items-stretch rounded-xl border border-border focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20">
              <span className="grid place-items-center rounded-l-xl bg-surface-muted px-3 font-mono text-xs text-text-muted sm:text-sm">
                /c/
              </span>
              <input
                id="slug"
                name="slug"
                required
                minLength={3}
                maxLength={60}
                value={slugValue}
                onChange={(e) =>
                  onSlugChange(e.target.value.toLowerCase().trim())
                }
                pattern="[a-z0-9\-]+"
                className="flex-1 rounded-r-xl border-0 bg-transparent px-3 py-3 font-mono text-sm text-foreground placeholder:text-text-muted focus:outline-none"
                aria-invalid={Boolean(
                  state.fieldErrors?.slug || slugClientError,
                )}
              />
            </div>
            {slugClientError ? (
              <p className="mt-1.5 text-xs text-red-600">{slugClientError}</p>
            ) : state.fieldErrors?.slug ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.slug}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-text-muted">
                Lowercase letters, numbers, and hyphens. Changing this breaks
                old shared links.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="whatsapp_number">
              WhatsApp number{" "}
              <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="whatsapp_number"
              name="whatsapp_number"
              type="tel"
              inputMode="tel"
              maxLength={20}
              defaultValue={business.whatsapp_number ?? ""}
              placeholder="08012345678 or +2348012345678"
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.whatsapp_number)}
            />
            {state.fieldErrors?.whatsapp_number ? (
              <p className="mt-1.5 text-xs text-red-600">
                {state.fieldErrors.whatsapp_number}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-text-muted">
                Needed for the &ldquo;Chat to order&rdquo; button on your
                catalogue.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Fulfillment */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-base font-medium text-foreground">Fulfillment</h2>
        <p className="mt-1 text-xs text-text-secondary">
          How customers receive orders. BizBot offers these when it confirms an
          order.
        </p>

        <input type="hidden" name="fulfillment_mode" value={fulfillmentMode} />
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              { value: "delivery", label: "Delivery only" },
              { value: "pickup", label: "Pickup only" },
              { value: "both", label: "Both" },
            ] as const
          ).map((opt) => {
            const active = fulfillmentMode === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => setFulfillmentMode(opt.value)}
                aria-pressed={active}
                className={
                  "rounded-xl px-4 py-3 text-sm font-medium ring-1 transition-colors " +
                  (active
                    ? "bg-foreground text-white ring-foreground"
                    : "bg-white text-foreground ring-black/[0.08] hover:bg-surface-muted")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <Label htmlFor="address">
            Store address{" "}
            <span className="font-normal text-text-muted">
              {pickupEnabled ? "(required for pickup)" : "(optional)"}
            </span>
          </Label>
          <textarea
            id="address"
            name="address"
            rows={2}
            maxLength={300}
            defaultValue={business.address ?? ""}
            placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
            className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            aria-invalid={Boolean(state.fieldErrors?.address)}
          />
          {state.fieldErrors?.address ? (
            <p className="mt-1.5 text-xs text-red-600">
              {state.fieldErrors.address}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-text-muted">
              Shown to customers for pickup orders.
            </p>
          )}
        </div>
      </section>

      {/* Catalogue visibility */}
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8">
        <h2 className="text-base font-medium text-foreground">
          Catalogue visibility
        </h2>
        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="catalogue_active"
            defaultChecked={business.catalogue_active}
            className="mt-1 size-4 rounded border-black/20 text-brand-primary focus:ring-brand-primary/30"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Catalogue is live
            </span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              When off, your public link shows a temporary unavailable
              message and no products.
            </span>
          </span>
        </label>
      </section>

      {/* Form-level error / success */}
      {state.status === "error" && state.error ? (
        <Notice variant="error">{state.error}</Notice>
      ) : null}
      {state.status === "success" ? (
        <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-dark ring-1 ring-brand-primary/20">
          Settings saved.
        </div>
      ) : null}

      <div className="flex items-center justify-end pt-2">
        <button
          type="submit"
          disabled={isPending || uploading || Boolean(slugClientError)}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
