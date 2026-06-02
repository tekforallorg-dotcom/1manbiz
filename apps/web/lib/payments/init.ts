import { createAdminClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack";

/**
 * Shared payment-initialization core. Called by both /api/payments/init (the
 * route, used by mobile via Bearer + the browser console) and the web
 * sendPaymentLinkAction server action. Resolving order ownership, generating
 * the reference, calling Paystack, and recording the pending payment row all
 * live here so the two callers cannot drift.
 *
 * Money-safety: caller passes only userId + orderId. Amount, email, reference,
 * and metadata are all derived server-side from the owner-scoped order.
 */

export type InitPaymentResult =
  | {
      ok: true;
      authorizationUrl: string;
      reference: string;
      amountKobo: number;
      orderId: string;
      customerId: string | null;
    }
  | { ok: false; error: string; status: number };

function buildReference(orderId: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return "1mb_" + orderId.replace(/-/g, "").slice(0, 12) + "_" + rand;
}

export async function initPaymentForOrder(
  userId: string,
  orderId: string,
  origin: string,
): Promise<InitPaymentResult> {
  if (!orderId) return { ok: false, error: "orderId required", status: 400 };

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business on file", status: 403 };

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, business_id, status, subtotal_kobo, currency, customer:customers(id, name, email)",
    )
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (orderErr) {
    console.error("[payments/init-core] order lookup failed", orderErr);
    return { ok: false, error: "Lookup failed", status: 500 };
  }
  if (!order) return { ok: false, error: "Order not found", status: 404 };
  if (order.status !== "pending") {
    return {
      ok: false,
      error: "Only pending orders can be paid (this one is " + order.status + ")",
      status: 409,
    };
  }
  if (!order.subtotal_kobo || order.subtotal_kobo <= 0) {
    return { ok: false, error: "Order has no payable amount", status: 400 };
  }

  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const customerEmail =
    customer && typeof customer.email === "string" && customer.email.includes("@")
      ? customer.email
      : "orders+" + order.id + "@1man.biz";

  const reference = buildReference(order.id);
  const callbackUrl = origin + "/pay/" + reference;

  const init = await initializeTransaction({
    email: customerEmail,
    amountKobo: order.subtotal_kobo,
    reference,
    callbackUrl,
    metadata: { order_id: order.id, business_id: business.id },
  });

  if (!init.ok) {
    console.error("[payments/init-core] paystack initialize failed", init.error);
    return { ok: false, error: init.error, status: 502 };
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
    console.error("[payments/init-core] payments insert failed after paystack init", insertErr);
    return {
      ok: false,
      error: "Payment session created but could not be saved. Please retry.",
      status: 500,
    };
  }

  return {
    ok: true,
    authorizationUrl: init.authorizationUrl,
    reference: init.reference,
    amountKobo: order.subtotal_kobo,
    orderId: order.id,
    customerId: customer?.id ?? null,
  };
}
