import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared expenses core. The API route and the (future) web server action both
 * call these, so business resolution, validation, and the DB writes live in one
 * place and cannot drift -- the same pattern as lib/payments/init.ts.
 *
 * Money note: unlike orders/payments (where the customer must never set the
 * amount), an expense amount is owner-authoritative input -- the vendor records
 * what they actually spent. We validate it hard at the boundary, but we do not
 * compute it. Every read and write is scoped to the caller's business.
 *
 * Timezone: occurred_at defaults to "today" in Africa/Lagos (UTC+1, no DST) and
 * future dates are rejected against the same clock, so a vendor recording an
 * expense near midnight is never bounced by the server's UTC date. Single-region
 * (Nigeria) assumption for MVP; revisit if the product goes multi-timezone.
 */

export const EXPENSE_CATEGORIES = [
  "inventory",
  "rent",
  "transport",
  "airtime_data",
  "salaries",
  "utilities",
  "marketing",
  "fees",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseRow = {
  id: string;
  business_id: string;
  amount_kobo: number;
  category: ExpenseCategory;
  occurred_at: string; // YYYY-MM-DD
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateExpenseInput = {
  amountKobo: unknown;
  category: unknown;
  occurredAt?: unknown;
  note?: unknown;
};

export type CreateExpenseResult =
  | { ok: true; expense: ExpenseRow }
  | { ok: false; error: string; status: number };

export type ListExpensesOptions = {
  month?: unknown; // "YYYY-MM"
  limit?: unknown;
};

export type ListExpensesResult =
  | { ok: true; expenses: ExpenseRow[]; totalKobo: number; period: string | null }
  | { ok: false; error: string; status: number };

const EXPENSE_COLS =
  "id, business_id, amount_kobo, category, occurred_at, note, created_at, updated_at";
const NOTE_MAX = 500;
// MVP scale: a month of expenses is far below this. total_kobo is summed over
// the returned rows, so this cap also bounds the total. If a business ever
// exceeds it, add real pagination plus a SUM rpc (separate slice).
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 500;

function lagosToday(): string {
  // Africa/Lagos is UTC+1 year-round (no DST). en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

async function resolveBusinessId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  return (business?.id as string | undefined) ?? null;
}

function isIntegerKobo(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isValidCategory(v: unknown): v is ExpenseCategory {
  return typeof v === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(v);
}

function parseOccurredAt(v: unknown): { ok: true; value: string } | { ok: false } {
  if (v === undefined || v === null || v === "") {
    return { ok: true, value: lagosToday() };
  }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false };
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return { ok: false };
  if (v > lagosToday()) return { ok: false }; // no future-dated expenses
  return { ok: true, value: v };
}

export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<CreateExpenseResult> {
  const admin = createAdminClient();

  const businessId = await resolveBusinessId(admin, userId);
  if (!businessId) return { ok: false, error: "No business on file", status: 403 };

  if (!isIntegerKobo(input.amountKobo)) {
    return {
      ok: false,
      error: "amount_kobo must be a whole number of kobo greater than 0",
      status: 400,
    };
  }
  if (!isValidCategory(input.category)) {
    return {
      ok: false,
      error: "category must be one of: " + EXPENSE_CATEGORIES.join(", "),
      status: 400,
    };
  }
  const occurred = parseOccurredAt(input.occurredAt);
  if (!occurred.ok) {
    return {
      ok: false,
      error: "occurred_at must be a valid YYYY-MM-DD date, not in the future",
      status: 400,
    };
  }

  let note: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== "string") {
      return { ok: false, error: "note must be a string", status: 400 };
    }
    const trimmed = input.note.trim();
    if (trimmed.length > NOTE_MAX) {
      return { ok: false, error: "note must be " + NOTE_MAX + " characters or fewer", status: 400 };
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  const { data, error } = await admin
    .from("expenses")
    .insert({
      business_id: businessId,
      amount_kobo: input.amountKobo,
      category: input.category,
      occurred_at: occurred.value,
      note,
    })
    .select(EXPENSE_COLS)
    .single();

  if (error || !data) {
    console.error("[expenses/create] insert failed", { businessId, error });
    return { ok: false, error: "Could not save expense", status: 500 };
  }

  console.log("[expenses/create] created", { businessId, expenseId: (data as ExpenseRow).id });
  return { ok: true, expense: data as ExpenseRow };
}

export async function listExpenses(
  userId: string,
  opts: ListExpensesOptions,
): Promise<ListExpensesResult> {
  const admin = createAdminClient();

  const businessId = await resolveBusinessId(admin, userId);
  if (!businessId) return { ok: false, error: "No business on file", status: 403 };

  // Optional month filter: "YYYY-MM" -> [first day, first day of next month).
  let period: string | null = null;
  let monthStart: string | null = null;
  let monthEnd: string | null = null;
  if (opts.month !== undefined && opts.month !== null && opts.month !== "") {
    if (typeof opts.month !== "string" || !/^\d{4}-\d{2}$/.test(opts.month)) {
      return { ok: false, error: "month must be in YYYY-MM format", status: 400 };
    }
    const [yStr, mStr] = opts.month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (m < 1 || m > 12) {
      return { ok: false, error: "month must be between 01 and 12", status: 400 };
    }
    period = opts.month;
    monthStart = opts.month + "-01";
    const nextY = m === 12 ? y + 1 : y;
    const nextM = m === 12 ? 1 : m + 1;
    monthEnd =
      String(nextY).padStart(4, "0") + "-" + String(nextM).padStart(2, "0") + "-01";
  }

  let limit = LIST_LIMIT_DEFAULT;
  if (opts.limit !== undefined && opts.limit !== null && opts.limit !== "") {
    const n = Number(opts.limit);
    if (!Number.isInteger(n) || n <= 0) {
      return { ok: false, error: "limit must be a positive integer", status: 400 };
    }
    limit = Math.min(n, LIST_LIMIT_MAX);
  }

  let query = admin
    .from("expenses")
    .select(EXPENSE_COLS)
    .eq("business_id", businessId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (monthStart && monthEnd) {
    query = query.gte("occurred_at", monthStart).lt("occurred_at", monthEnd);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[expenses/list] select failed", { businessId, error });
    return { ok: false, error: "Could not load expenses", status: 500 };
  }

  const expenses = (data ?? []) as ExpenseRow[];
  const totalKobo = expenses.reduce((sum, e) => sum + Number(e.amount_kobo), 0);

  return { ok: true, expenses, totalKobo, period };
}
