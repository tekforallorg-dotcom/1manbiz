import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { updateExpense, deleteExpense } from "@/lib/expenses/core";

/**
 * Single-expense API. PATCH updates the provided fields; DELETE removes the row.
 *
 * Auth: dual-mode (cookie session for web, Bearer JWT for mobile), mirroring
 * /api/orders/mark-paid and /api/expenses. Validation and the business-scoped
 * writes live in lib/expenses/core, shared with the collection route and the
 * web server actions so nothing drifts.
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;

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

  const result = await updateExpense(userId, id, {
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }
  const { id } = await params;

  const result = await deleteExpense(userId, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
