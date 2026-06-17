"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { updateCustomerAction, type UpdateCustomerState } from "../actions";

const initialState: UpdateCustomerState = { status: "idle", error: null, fieldErrors: {} };

export function EditCustomer({
  customerId,
  initialName,
  initialNotes,
}: {
  customerId: string;
  initialName: string;
  initialNotes: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCustomerAction, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && state.status === "success") {
      setOpen(false);
    }
    wasPending.current = isPending;
  }, [isPending, state.status]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Edit customer"
        className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
      >
        <Pencil size={16} strokeWidth={2} />
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-5 border-t border-border pt-5">
      <input type="hidden" name="customerId" value={customerId} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Edit details</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel editing"
          className="grid size-8 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            name="name"
            required
            maxLength={120}
            defaultValue={initialName}
            className="mt-1.5"
            aria-invalid={Boolean(state.fieldErrors?.name)}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <Label htmlFor="edit-notes">
            Notes <span className="font-normal text-text-muted">(optional)</span>
          </Label>
          <textarea
            id="edit-notes"
            name="notes"
            maxLength={1000}
            rows={3}
            defaultValue={initialNotes}
            placeholder="Anything worth remembering about this customer"
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
          {state.fieldErrors?.notes ? (
            <p className="mt-1.5 text-xs text-red-600">{state.fieldErrors.notes}</p>
          ) : null}
        </div>
      </div>

      {state.status === "error" && state.error ? (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
