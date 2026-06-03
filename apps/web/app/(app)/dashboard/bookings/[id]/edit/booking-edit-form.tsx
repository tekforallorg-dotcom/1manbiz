"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Label } from "@/components/ui/label";
import { updateBookingAction, type UpdateBookingState } from "../../actions";

const initialState: UpdateBookingState = { status: "idle", error: null };

export function BookingEditForm(props: {
  bookingId: string;
  initialTitle: string;
  initialStartsAt: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const action = updateBookingAction.bind(null, props.bookingId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [title, setTitle] = useState(props.initialTitle);
  const [startsAt, setStartsAt] = useState(props.initialStartsAt);
  const [notes, setNotes] = useState(props.initialNotes);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/dashboard/bookings/" + props.bookingId);
    }
  }, [state.status, props.bookingId, router]);

  const canSubmit = title.trim() !== "" && startsAt !== "";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="starts_at" value={startsAt} />
      <input type="hidden" name="notes" value={notes} />

      {state.status === "error" && state.error ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
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
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
