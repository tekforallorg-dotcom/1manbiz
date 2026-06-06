import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendReceiptForOrder } from "@/lib/receipt-send";

/**
 * Paystack webhook. The ONLY trusted path that marks an order paid.
 *
 * Security model:
 *   - The browser callback after checkout is NEVER trusted to confirm payment.
 *     Only this server-to-server webhook, with a verified signature, flips an
 *     order to paid.
 *   - Signature: HMAC-SHA512 of the raw request body using PAYSTACK_SECRET_KEY,
 *     compared to the x-paystack-signature header. Mismatch -> 401, no action.
 *   - If the secret is not configured we REJECT (unlike the WhatsApp webhook's
 *     dev-mode passthrough): an unsigned "payment succeeded" must never be
 *     honoured for money.
 *   - Idempotent: Paystack retries. Re-processing a reference already marked
 *     success is a no-op 200.
 *   - Amount re-check: the order is only marked paid if the event amount matches
 *     the stored payments.amount_kobo. Mismatch -> payment marked failed, order
 *     left pending, logged loudly.
 *
 * The order paid_at / receipt_code / customer rollups are handled by the
 * existing tg_order_status_change trigger when orders.status flips to 'paid'.
 */

export const dynamic = "force-dynamic";

const SECRET = process.env.PAYSTACK_SECRET_KEY;

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!SECRET) return false; // No secret -> cannot verify -> reject (money path).
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET.trim()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(rawBody),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === signatureHeader;
}

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    status?: string;
    currency?: string;
  };
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-paystack-signature");

  const valid = await verifySignature(rawBody, signatureHeader);
  if (!valid) {
    console.warn("[paystack-webhook] signature mismatch or no secret -- rejecting");
    return new NextResponse("Forbidden", { status: 401 });
  }

  let payload: PaystackEvent;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[paystack-webhook] non-JSON body", rawBody.slice(0, 200));
    return NextResponse.json({ ok: true });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: payload.event ?? "unknown" });
  }

  const reference = payload.data?.reference;
  const eventAmount = payload.data?.amount;
  if (!reference) {
    console.warn("[paystack-webhook] charge.success with no reference");
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  const { data: payment, error: payErr } = await admin
    .from("payments")
    .select("id, order_id, business_id, amount_kobo, status")
    .eq("provider", "paystack")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (payErr) {
    console.error("[paystack-webhook] payment lookup failed", payErr);
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }
  if (!payment) {
    console.warn("[paystack-webhook] unknown reference", reference);
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "success") {
    return NextResponse.json({ ok: true, already: true });
  }

  if (typeof eventAmount !== "number" || eventAmount !== payment.amount_kobo) {
    console.error("[paystack-webhook] amount mismatch", {
      reference,
      eventAmount,
      expected: payment.amount_kobo,
    });
    await admin
      .from("payments")
      .update({ status: "failed", raw_event: payload })
      .eq("id", payment.id);
    return NextResponse.json({ ok: true, mismatch: true });
  }

  const { error: payUpdateErr } = await admin
    .from("payments")
    .update({ status: "success", raw_event: payload })
    .eq("id", payment.id);
  if (payUpdateErr) {
    console.error("[paystack-webhook] payment update failed", payUpdateErr);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  const { data: order, error: orderFetchErr } = await admin
    .from("orders")
    .select("id, status")
    .eq("id", payment.order_id)
    .eq("business_id", payment.business_id)
    .maybeSingle();

  if (orderFetchErr || !order) {
    console.error("[paystack-webhook] order fetch failed", orderFetchErr);
    return NextResponse.json({ error: "order fetch failed" }, { status: 500 });
  }

  if (order.status === "paid") {
    return NextResponse.json({ ok: true, orderAlreadyPaid: true });
  }
  if (order.status === "cancelled") {
    console.warn("[paystack-webhook] payment for a cancelled order", {
      reference,
      orderId: order.id,
    });
    return NextResponse.json({ ok: true, orderCancelled: true });
  }

  const { error: orderUpdateErr } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", order.id)
    .eq("business_id", payment.business_id);

  if (orderUpdateErr) {
    console.error("[paystack-webhook] order paid update failed", orderUpdateErr);
    return NextResponse.json({ error: "order update failed" }, { status: 500 });
  }

  // Auto-send the receipt to the customer (best-effort). The payment is already
  // confirmed and the order is paid; never fail the webhook on this side effect.
  // The receipt_code was generated by the paid trigger on the update above.
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = host ? proto + "://" + host : "https://1manbiz.vercel.app";
    const receipt = await sendReceiptForOrder(admin, { orderId: order.id, origin });
    if (!receipt.sent) {
      console.warn("[paystack-webhook] receipt not sent", {
        orderId: order.id,
        reason: receipt.reason,
      });
    }
  } catch (e) {
    console.error("[paystack-webhook] receipt auto-send threw", e);
  }

  console.log("[paystack-webhook] order marked paid", {
    reference,
    orderId: order.id,
  });
  return NextResponse.json({ ok: true });
}
