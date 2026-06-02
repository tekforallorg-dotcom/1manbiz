import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { initializeTransaction } from "@/lib/paystack";

/**
 * Initialize a Paystack hosted-checkout payment for a pending order.
 *
 * Auth: dual-mode (cookie session for web, Bearer JWT for mobile), mirroring
 * /api/messages/send.
 *
 * Flow:
 *   1. Authenticate -> user_id.
 *   2. Resolve user_id -> business_id (owner).
 *   3. Load order scoped to business_id (404 on cross-tenant id).
 *   4. Guard: order must be 'pending'.
 *   5. Generate a server-side reference; amount comes from order.subtotal_kobo
 *      (NEVER from the client).
 *   6. Call Paystack initialize with a callback to /pay/<reference>.
 *   7. Insert a 'pending' row in payments; return { authorization_url, reference }.
 *
 * Money-safety: the client supplies only orderId. Amount, email, reference, and
 * metadata are all derived server-side. The payments.unique(provider,reference)
 * constraint plus the webhook (P3) provide idempotent confirmation.
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

function buildReference(orderId: string): string {
  // Short, URL-safe, unique per attempt. Prefixed for easy log grepping.
  const rand = Math.random().toString(36).slice(2, 10);
  return "1mb_" + orderId.replace(/-/g, "").slice(0, 12) + "_" + rand;
}

export async function POST(request: NextRequest) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: { orderId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ error: "No business on file" }, { status: 403 });
  }

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, business_id, status, subtotal_kobo, currency, customer:customers(id, name, email)",
    )
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (orderErr) {
    console.error("[payments/init] order lookup failed", orderErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending orders can be paid (this one is " + order.status + ")" },
      { status: 409 },
    );
  }
  if (!order.subtotal_kobo || order.subtotal_kobo <= 0) {
    return NextResponse.json({ error: "Order has no payable amount" }, { status: 400 });
  }

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const customerEmail =
    customer && typeof customer.email === "string" && customer.email.includes("@")
      ? customer.email
      : "orders+" + order.id + "@1man.biz";

  const reference = buildReference(order.id);
  const callbackUrl = request.nextUrl.origin + "/pay/" + reference;

  const init = await initializeTransaction({
    email: customerEmail,
    amountKobo: order.subtotal_kobo,
    reference,
    callbackUrl,
    metadata: {
      order_id: order.id,
      business_id: business.id,
    },
  });

  if (!init.ok) {
    console.error("[payments/init] paystack initialize failed", init.error);
    return NextResponse.json({ error: init.error }, { status: 502 });
  }

  const { error: insertErr } = await admin.from("payments").insert({
    order_id: order.id,
    business_id: business.id,
    provider: "paystack",
    provider_reference: init.reference,
    amount_kobo: order.subtotal_kobo,
    currency: order.currency ?? "NGN",
    status: "pending",
    authorization_url: init.authorizationUrl,
  });

  if (insertErr) {
    console.error("[payments/init] payments insert failed after paystack init", insertErr);
    return NextResponse.json(
      { error: "Payment session created but could not be saved. Please retry." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    authorization_url: init.authorizationUrl,
    reference: init.reference,
  });
}
