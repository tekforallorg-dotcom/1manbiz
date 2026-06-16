"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  type CreateExpenseInput,
  type UpdateExpenseInput,
  type ExpenseRow,
} from "@/lib/expenses/core";

/**
 * Web server actions for the Money > Expenses screen. These are the web twin of
 * the /api/expenses routes (mobile): same shared core, same business scoping.
 * The action authenticates via the SSR client, calls the core, then revalidates
 * both Money routes so the Overview hero (money out / profit) and the Expenses
 * list reflect the change on next render. The client also updates its local list
 * from the returned row for instant feedback; the database stays authoritative.
 */

export type ExpenseActionResult =
  | { ok: true; expense: ExpenseRow }
  | { ok: false; error: string };

export type DeleteActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidateMoney(): void {
  revalidatePath("/dashboard/money");
  revalidatePath("/dashboard/money/expenses");
}

export async function createExpenseAction(
  input: CreateExpenseInput,
): Promise<ExpenseActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const res = await createExpense(userId, input);
  if (!res.ok) return { ok: false, error: res.error };

  revalidateMoney();
  return { ok: true, expense: res.expense };
}

export async function updateExpenseAction(
  id: string,
  patch: UpdateExpenseInput,
): Promise<ExpenseActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const res = await updateExpense(userId, id, patch);
  if (!res.ok) return { ok: false, error: res.error };

  revalidateMoney();
  return { ok: true, expense: res.expense };
}

export async function deleteExpenseAction(id: string): Promise<DeleteActionResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const res = await deleteExpense(userId, id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidateMoney();
  return { ok: true, id: res.id };
}
