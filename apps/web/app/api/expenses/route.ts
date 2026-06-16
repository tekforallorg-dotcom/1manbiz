import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { createExpense, listExpenses } from "@/lib/expenses/core";

/**
 * Expenses API. POST records an expense; GET lists them (optionally by month).
 *
 * Auth: dual-mode (cookie session for web, Bearer JWT for mobile), mirroring
 * /api/orders/mark-paid and /api/payments/init. Validation, business
 * resolution, and the DB writes live in lib/expenses/core so the future web
 * server action shares them without drift.
 */

export const dynamic = "force-dynamic";

async function authenticate(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (!token) return null;
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  }
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let payload: {
    amount_kobo?: unknown;
    category?: unknown;
    occurred_at?: unknown;
    note?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createExpense(userId, {
    amountKobo: payload.amount_kobo,
    category: payload.category,
    occurredAt: payload.occurred_at,
    note: payload.note,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, expense: result.expense });
}

export async function GET(request: NextRequest) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const result = await listExpenses(userId, {
    month: searchParams.get("month") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    expenses: result.expenses,
    total_kobo: result.totalKobo,
    period: result.period,
  });
}
