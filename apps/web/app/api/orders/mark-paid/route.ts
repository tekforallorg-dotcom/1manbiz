import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { sendReceiptForOrder } from "@/lib/receipt-send";

/**
 * Mark an order paid (owner action), then auto-send the receipt.
 *
 * Exists because the mobile client cannot call the web server action; it needs
 * an HTTP endpoint. This is the mobile twin of markOrderPaidAction: it flips the
 * order to paid (server-side, ownership verified in code) and then calls
 * sendReceiptForOrder so the customer gets their receipt on WhatsApp, exactly
 * like the Paystack webhook and the web Mark paid.
 *
 * Auth: dual-mode (Bearer for mobile, cookie for web), mirroring
 * /api/messages/send. The paid transition uses the admin client AFTER the order
 * is scoped to the caller's business; we never trust a client-supplied id
 * without scoping.
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

  let payload: { orderId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No business" }, { status: 403 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  if (order.status === "cancelled") {
    return NextResponse.json(
      { ok: false, error: "Cannot mark a cancelled order as paid." },
      { status: 409 },
    );
  }

  if (order.status !== "paid") {
    const { error: updateErr } = await admin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", orderId)
      .eq("business_id", business.id);
    if (updateErr) {
      console.error("[orders/mark-paid] paid update failed", updateErr);
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }
  }

  // Best-effort: auto-send the receipt. The paid status is committed; never fail
  // the request on the messaging side effect. receipt_sent_at guards dupes.
  let receiptSent = false;
  try {
    const receipt = await sendReceiptForOrder(admin, { orderId, origin: request.nextUrl.origin });
    receiptSent = receipt.sent;
    if (!receipt.sent) {
      console.warn("[orders/mark-paid] receipt not sent", { orderId, reason: receipt.reason });
    }
  } catch (e) {
    console.error("[orders/mark-paid] receipt auto-send threw", e);
  }

  return NextResponse.json({ ok: true, receiptSent });
}
