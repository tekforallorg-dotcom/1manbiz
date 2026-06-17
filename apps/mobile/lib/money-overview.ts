import { supabase } from "./supabase";

// Money overview for the Money tab. Income is the sum of paid-order subtotals
// in the period (same definition the web Overview and the dashboard revenue
// tile use); expenses is the sum of recorded expenses in the period; profit is
// the difference. Individual query failure degrades to 0 and is logged, so the
// hero still renders.

export type MoneyPeriodDays = 7 | 30 | 90;

export interface MoneyOverview {
  incomeKobo: number;
  expensesKobo: number;
  profitKobo: number;
}

function pad(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

// Start of the rolling window: now minus `days`. Returns an ISO timestamp (for
// paid_at, a timestamptz) and a YYYY-MM-DD date (for occurred_at, a date).
function windowStart(days: number): { iso: string; date: string } {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return {
    iso: d.toISOString(),
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

export async function fetchMoneyOverview(
  businessId: string,
  periodDays: MoneyPeriodDays,
): Promise<MoneyOverview> {
  const start = windowStart(periodDays);

  const [incomeRes, expenseRes] = await Promise.all([
    supabase
      .from("orders")
      .select("subtotal_kobo")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", start.iso),
    supabase
      .from("expenses")
      .select("amount_kobo")
      .eq("business_id", businessId)
      .gte("occurred_at", start.date),
  ]);

  if (incomeRes.error) console.error("[money] income query:", incomeRes.error);
  if (expenseRes.error) console.error("[money] expenses query:", expenseRes.error);

  const incomeKobo = incomeRes.error
    ? 0
    : (incomeRes.data ?? []).reduce((sum, row) => sum + (row.subtotal_kobo ?? 0), 0);
  const expensesKobo = expenseRes.error
    ? 0
    : (expenseRes.data ?? []).reduce((sum, row) => sum + (row.amount_kobo ?? 0), 0);

  return { incomeKobo, expensesKobo, profitKobo: incomeKobo - expensesKobo };
}
