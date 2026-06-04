import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";

/**
 * Records the human verdict on a prior AI decision (the semi-autonomous
 * evidence loop). The parse-order endpoint logs a proposal at outcome
 * 'pending'; once the vendor accepts / edits / rejects it -- or an order is
 * created from it -- the client calls this to close the loop. That accepted-vs-
 * proposed signal is what proves the autonomous mode is safe before it is
 * switched on.
 *
 * Auth mirrors /api/ai/parse-order (cookie for web, Bearer for mobile).
 * Ownership is enforced by matching the decision's business_id to the caller's
 * business before updating.
 */

export const dynamic = "force-dynamic";

const VALID_OUTCOMES = ["accepted", "edited", "rejected", "auto_sent"] as const;
type Outcome = (typeof VALID_OUTCOMES)[number];

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
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let payload: { decisionId?: string; outcome?: string; finalOrderId?: string | null };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const decisionId = typeof payload.decisionId === "string" ? payload.decisionId : "";
  const outcome = typeof payload.outcome === "string" ? payload.outcome : "";
  const finalOrderId =
    typeof payload.finalOrderId === "string" && payload.finalOrderId ? payload.finalOrderId : null;

  if (!decisionId) {
    return NextResponse.json({ ok: false, error: "decisionId required" }, { status: 400 });
  }
  if (!VALID_OUTCOMES.includes(outcome as Outcome)) {
    return NextResponse.json({ ok: false, error: "Invalid outcome" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No business on file" }, { status: 403 });
  }

  // Owner-scoped update: only a decision belonging to the caller's business can
  // be closed, and only from the still-open 'pending' state (idempotent: a
  // second call is a no-op rather than rewriting history).
  const { data: updated, error: updErr } = await admin
    .from("ai_decisions")
    .update({
      outcome,
      outcome_at: new Date().toISOString(),
      final_order_id: finalOrderId,
    })
    .eq("id", decisionId)
    .eq("business_id", business.id)
    .eq("outcome", "pending")
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error("[ai/decision-outcome] update failed", updErr);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, updated: Boolean(updated) });
}
