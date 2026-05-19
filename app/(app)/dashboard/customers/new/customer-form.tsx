"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createCustomerAction, type CreateCustomerState } from "../actions";

const initialState: CreateCustomerState = {
  status: "idle",
  error: null,
  fieldErrors: {},
};

export function CustomerForm() {
  const [state, formAction, isPending] = useActionState(createCustomerAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Contact</h2>

        <div className="mt-5 space-y-5">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Adaeze Kalu"
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name ? (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="phone">WhatsApp number</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              required
              maxLength={20}
              placeholder="08012345678 or +2348012345678"
              className="mt-1.5 tabular-nums"
              aria-invalid={Boolean(state.fieldErrors?.phone)}
            />
            {state.fieldErrors?.phone ? (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.phone}</p>
            ) : (
              <p className="mt-1.5 text-xs text-text-muted">Used to reach this customer on WhatsApp.</p>
            )}
          </div>

          <div>
            <Label htmlFor="email">
              Email <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              maxLength={200}
              placeholder="customer@example.com"
              className="mt-1.5"
              aria-invalid={Boolean(state.fieldErrors?.email)}
            />
            {state.fieldErrors?.email ? (
              <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.email}</p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="notes">
              Notes <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <textarea
              id="notes"
              name="notes"
              maxLength={1000}
              rows={3}
              placeholder="Anything worth remembering about this customer"
              className="mt-1.5 w-full resize-none rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            />
          </div>
        </div>
      </section>

      {state.status === "error" && state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href="/dashboard/customers"
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add customer"}
        </button>
      </div>
    </form>
  );
}
