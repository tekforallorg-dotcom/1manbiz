import { supabase } from "./supabase";

// Expenses data for mobile. Reads and writes go through the Supabase client
// under RLS (private.is_business_owner), the same table the web app uses. Money
// is stored in kobo; conversion happens only at the form boundary via
// parseNairaToKobo / formatNairaFromKobo in lib/money.ts.

export interface ExpenseRow {
  id: string;
  amount_kobo: number;
  category: string;
  occurred_at: string; // YYYY-MM-DD
  note: string | null;
  source: string;
  created_at: string;
}

// Vendor-natural labels mapped onto the stored slugs (single source of the
// slug list; the DB check constraint is the ultimate authority).
export const EXPENSE_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "stock", label: "Stock" },
  { value: "delivery", label: "Delivery" },
  { value: "transport", label: "Transport" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "airtime_data", label: "Airtime & Data" },
  { value: "salaries", label: "Salaries" },
  { value: "packaging", label: "Packaging" },
  { value: "marketing", label: "Marketing" },
  { value: "fees", label: "Fees" },
  { value: "other", label: "Other" },
];

export function labelForCategory(slug: string): string {
  return EXPENSE_CATEGORY_OPTIONS.find((o) => o.value === slug)?.label ?? slug;
}

const COLUMNS = "id, amount_kobo, category, occurred_at, note, source, created_at";

// Recent expenses for a business, newest first. Returns [] on error (logged).
export async function fetchExpenses(businessId: string): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[expenses] fetch:", error);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}

// Single expense by id, scoped to the business. null if not found / not owned.
export async function fetchExpense(
  businessId: string,
  id: string,
): Promise<ExpenseRow | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[expenses] fetch one:", error);
    return null;
  }
  return (data as ExpenseRow | null) ?? null;
}

export interface ExpenseInput {
  businessId: string;
  amountKobo: number;
  category: string;
  occurredAt: string; // YYYY-MM-DD
  note: string;
}

export async function createExpense(
  input: ExpenseInput,
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      business_id: input.businessId,
      amount_kobo: input.amountKobo,
      category: input.category,
      occurred_at: input.occurredAt,
      note: input.note.trim() ? input.note.trim() : null,
      source: "manual",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data?.id };
}

export async function updateExpense(
  id: string,
  input: ExpenseInput,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("expenses")
    .update({
      amount_kobo: input.amountKobo,
      category: input.category,
      occurred_at: input.occurredAt,
      note: input.note.trim() ? input.note.trim() : null,
    })
    .eq("id", id)
    .eq("business_id", input.businessId);

  if (error) return { error: error.message };
  return {};
}

export async function deleteExpense(
  businessId: string,
  id: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) return { error: error.message };
  return {};
}
