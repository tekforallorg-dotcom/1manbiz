import { createAdminClient } from "@/lib/supabase/admin";
import { initializeTransaction } from "@/lib/paystack";

/**
 * Shared payment-initialization core. Two entry points that must never drift:
 *   - initPaymentForOrder(userId, ...)             -> vendor session (route + web action)
 *   - initPaymentForBusinessOrder(businessId, ...) -> session-less WhatsApp AI
 * The user-scoped wrapper resolves the business from userId then delegates, so
 * the order lookup, reference generation, Paystack call, and pending-payment
 * insert all live in one place.
 *
 * Money-safety: callers pass only ids. Amount, email, reference, and metadata
 * are all derived server-side from the resolved order; no caller can set money.
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

  return initPaymentForBusinessOrder(business.id as string, orderId, origin);
}

/**
 * Business-scoped payment initialization. Same money-safe path as the
 * user-scoped wrapper above, but resolves the order by business_id directly so
 * the session-less WhatsApp AI (which has businessId + orderId, no vendor auth)
 * can mint a checkout link without drifting from the vendor path. The caller
 * passes only ids; amount, email, reference, and metadata are all derived here
 * from the business-scoped order, so the model can never set money.
 */
export async function initPaymentForBusinessOrder(
  businessId: string,
  orderId: string,
  origin: string,
): Promise<InitPaymentResult> {
  if (!businessId) return { ok: false, error: "businessId required", status: 400 };
  if (!orderId) return { ok: false, error: "orderId required", status: 400 };

  const admin = createAdminClient();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select(
      "id, business_id, status, subtotal_kobo, currency, customer:customers(id, name, email)",
    )
    .eq("id", orderId)
    .eq("business_id", businessId)
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
    metadata: { order_id: order.id, business_id: businessId },
  });

  if (!init.ok) {
    console.error("[payments/init-core] paystack initialize failed", init.error);
    return { ok: false, error: init.error, status: 502 };
  }

  const { error: insertErr } = await admin.from("payments").insert({
    order_id: order.id,
    business_id: businessId,
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
