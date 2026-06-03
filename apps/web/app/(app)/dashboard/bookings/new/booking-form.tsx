"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { createBookingAction, type CreateBookingState } from "../actions";

type Customer = { id: string; name: string };
type Product = { id: string; name: string };

const initialState: CreateBookingState = { status: "idle", error: null };

export function BookingForm(props: { customers: Customer[]; products: Product[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createBookingAction, initialState);

  const [customerId, setCustomerId] = useState("");
  const [title, setTitle] = useState("");
  const [productId, setProductId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");

  function onPickProduct(id: string) {
    setProductId(id);
    if (!title.trim() && id) {
      const p = props.products.find((x) => x.id === id);
      if (p) setTitle(p.name);
    }
  }

  // On clean success, go straight to the list. If the booking was created but
  // overlaps another (soft conflict), stay and surface the warning instead of
  // silently redirecting -- the booking still exists either way.
  useEffect(() => {
    if (state.status === "success" && !state.conflictWarning) {
      router.push("/dashboard/bookings");
    }
  }, [state.status, state.conflictWarning, router]);

  const canSubmit = customerId !== "" && title.trim() !== "" && startsAt !== "";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="starts_at" value={startsAt} />
      <input type="hidden" name="ends_at" value={endsAt} />
      <input type="hidden" name="notes" value={notes} />

      {state.status === "error" && state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}

      {state.status === "success" && state.conflictWarning ? (
        <div className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning ring-1 ring-warning/20">
          <p className="font-medium">Booking created.</p>
          <p className="mt-0.5">{state.conflictWarning}</p>
          <a href="/dashboard/bookings" className="mt-2 inline-block font-medium text-foreground underline">
            View bookings
          </a>
        </div>
      ) : null}

      <div>
        <Label htmlFor="customer-select">Customer</Label>
        <select
          id="customer-select"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          aria-invalid={Boolean(state.fieldErrors?.customer_id)}
        >
          <option value="">Select a customer...</option>
          {props.customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {state.fieldErrors?.customer_id ? (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.customer_id}</p>
        ) : null}
      </div>

      {props.products.length > 0 ? (
        <div>
          <Label htmlFor="service-select">Service (optional)</Label>
          <select
            id="service-select"
            value={productId}
            onChange={(e) => onPickProduct(e.target.value)}
            className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          >
            <option value="">No specific service</option>
            {props.products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <Label htmlFor="title-input">Title</Label>
        <input
          id="title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Haircut, Fitting, Repair drop-off"
          className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        {state.fieldErrors?.title ? (
          <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.title}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="starts-input">Starts</Label>
          <input
            id="starts-input"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            aria-invalid={Boolean(state.fieldErrors?.starts_at)}
          />
          {state.fieldErrors?.starts_at ? (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.starts_at}</p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="ends-input">Ends (optional)</Label>
          <input
            id="ends-input"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            aria-invalid={Boolean(state.fieldErrors?.ends_at)}
          />
          {state.fieldErrors?.ends_at ? (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.ends_at}</p>
          ) : null}
        </div>
      </div>

      <div>
        <Label htmlFor="notes-input">Notes (optional)</Label>
        <textarea
          id="notes-input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything to remember for this appointment"
          className="mt-1.5 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Create booking"}
      </button>
    </form>
  );
}
