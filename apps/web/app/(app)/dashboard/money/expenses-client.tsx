"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

import { formatNairaFromKobo, parseNairaInputToKobo } from "@/lib/format";
import type { ExpenseRow } from "@/lib/expenses/core";

import {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from "./actions";

/**
 * Money > Expenses interactive surface. Holds the row list in local state seeded
 * from the server, and on each mutation calls the matching server action and
 * patches local state from the returned row for instant feedback. The action
 * also revalidates the Money routes, so the Overview totals stay correct. The
 * category picker uses vendor-natural labels passed down from the server (the DB
 * stores the slug); amounts are entered in naira and converted to kobo here.
 */

type CategoryOption = { value: string; label: string };

type FormState = {
  amount: string;
  category: string;
  occurredAt: string;
  note: string;
};

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-brand-primary";

function todayInputValue(): string {
  // Local date as YYYY-MM-DD for the date input default. A Lagos user's local
  // date matches the server's Africa/Lagos future-date check.
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}

function emptyForm(defaultCategory: string): FormState {
  return {
    amount: "",
    category: defaultCategory,
    occurredAt: todayInputValue(),
    note: "",
  };
}

function formatDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function ExpensesClient({
  initial,
  categoryOptions,
}: {
  initial: ExpenseRow[];
  categoryOptions: CategoryOption[];
}) {
  const defaultCategory = categoryOptions[0]?.value ?? "other";

  const [rows, setRows] = useState<ExpenseRow[]>(initial);
  const [addForm, setAddForm] = useState<FormState>(() => emptyForm(defaultCategory));
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(() => emptyForm(defaultCategory));
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labelFor = useMemo(() => {
    const map = new Map(categoryOptions.map((o) => [o.value, o.label]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [categoryOptions]);

  const totalKobo = rows.reduce((sum, r) => sum + Number(r.amount_kobo), 0);

  function submitAdd() {
    setAddError(null);
    const amountKobo = parseNairaInputToKobo(addForm.amount);
    if (amountKobo <= 0) {
      setAddError("Enter an amount greater than 0.");
      return;
    }
    startTransition(async () => {
      const res = await createExpenseAction({
        amountKobo,
        category: addForm.category,
        occurredAt: addForm.occurredAt,
        note: addForm.note.trim().length > 0 ? addForm.note.trim() : undefined,
      });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      setRows((prev) => [res.expense, ...prev]);
      setAddForm(emptyForm(defaultCategory));
    });
  }

  function startEdit(row: ExpenseRow) {
    setConfirmingId(null);
    setEditError(null);
    setEditingId(row.id);
    setEditForm({
      amount: String(Number(row.amount_kobo) / 100),
      category: row.category,
      occurredAt: row.occurred_at,
      note: row.note ?? "",
    });
  }

  function submitEdit(id: string) {
    setEditError(null);
    const amountKobo = parseNairaInputToKobo(editForm.amount);
    if (amountKobo <= 0) {
      setEditError("Enter an amount greater than 0.");
      return;
    }
    startTransition(async () => {
      const res = await updateExpenseAction(id, {
        amountKobo,
        category: editForm.category,
        occurredAt: editForm.occurredAt,
        note: editForm.note.trim().length > 0 ? editForm.note.trim() : null,
      });
      if (!res.ok) {
        setEditError(res.error);
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === id ? res.expense : r)));
      setEditingId(null);
    });
  }

  function doDelete(id: string) {
    startTransition(async () => {
      const res = await deleteExpenseAction(id);
      if (res.ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        setConfirmingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-sm font-semibold text-foreground">Add an expense</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Amount">
            <input
              inputMode="decimal"
              value={addForm.amount}
              onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <Field label="Category">
            <select
              value={addForm.category}
              onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
              className={inputClass}
            >
              {categoryOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={addForm.occurredAt}
              max={todayInputValue()}
              onChange={(e) => setAddForm({ ...addForm, occurredAt: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Note (optional)">
            <input
              value={addForm.note}
              onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
              placeholder="e.g. fuel for delivery"
              className={inputClass}
            />
          </Field>
        </div>
        {addError ? <p className="mt-3 text-sm text-error">{addError}</p> : null}
        <div className="mt-4">
          <button
            type="button"
            onClick={submitAdd}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Add expense
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-foreground">Expenses</h2>
          <p className="text-sm tabular-nums text-text-muted">
            {rows.length} {rows.length === 1 ? "entry" : "entries"} &middot;{" "}
            {formatNairaFromKobo(totalKobo)}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <p className="text-sm font-medium text-foreground">No expenses yet</p>
            <p className="mt-1 text-sm text-text-muted">
              Add your first expense above to see your real profit.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isEditing = editingId === row.id;
              const isConfirming = confirmingId === row.id;

              if (isEditing) {
                return (
                  <li key={row.id} className="px-5 py-4 sm:px-6">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label="Amount">
                          <input
                            inputMode="decimal"
                            value={editForm.amount}
                            onChange={(e) =>
                              setEditForm({ ...editForm, amount: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Category">
                          <select
                            value={editForm.category}
                            onChange={(e) =>
                              setEditForm({ ...editForm, category: e.target.value })
                            }
                            className={inputClass}
                          >
                            {categoryOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Date">
                          <input
                            type="date"
                            value={editForm.occurredAt}
                            max={todayInputValue()}
                            onChange={(e) =>
                              setEditForm({ ...editForm, occurredAt: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Note (optional)">
                          <input
                            value={editForm.note}
                            onChange={(e) =>
                              setEditForm({ ...editForm, note: e.target.value })
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                      {editError ? (
                        <p className="text-sm text-error">{editError}</p>
                      ) : null}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => submitEdit(row.id)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={pending}
                          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-text-secondary transition-colors hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  </li>
                );
              }

              return (
                <li key={row.id} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                          {labelFor(row.category)}
                        </span>
                        <span className="text-xs text-text-muted">
                          {formatDate(row.occurred_at)}
                        </span>
                      </div>
                      {row.note ? (
                        <p className="mt-1 truncate text-sm text-text-secondary">{row.note}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {formatNairaFromKobo(row.amount_kobo)}
                      </span>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => doDelete(row.id)}
                            disabled={pending}
                            className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            disabled={pending}
                            className="rounded-full px-2 py-1 text-[12px] font-semibold text-text-muted transition-colors hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Edit expense"
                            onClick={() => startEdit(row)}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete expense"
                            onClick={() => {
                              setEditingId(null);
                              setConfirmingId(row.id);
                            }}
                            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
