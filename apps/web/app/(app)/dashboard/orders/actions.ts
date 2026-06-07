"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CreateOrderState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

type SubmittedItem = { product_id: string; quantity: number };

export async function createOrderAction(
  _prev: CreateOrderState,
  formData: FormData
): Promise<CreateOrderState> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[orders] resolve business failed", businessError);
    return { status: "error", error: "No business found for this account." };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "[]");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};
  if (!customerId) fieldErrors.customer_id = "Pick a customer";

  let submittedItems: SubmittedItem[] = [];
  try {
    const parsed = JSON.parse(itemsRaw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    submittedItems = parsed
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        product_id: String(it.product_id ?? ""),
        quantity: Math.max(1, Math.floor(Number(it.quantity ?? 0))),
      }))
      .filter((it) => it.product_id && it.quantity > 0);
  } catch (e) {
    console.error("[orders] items JSON parse failed", e);
    fieldErrors.items = "Could not read order items";
  }

  if (submittedItems.length === 0 && !fieldErrors.items) {
    fieldErrors.items = "Add at least one item";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!customer) {
    return { status: "error", error: "Customer not found.", fieldErrors: { customer_id: "Pick a valid customer" } };
  }

  const productIds = submittedItems.map((it) => it.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price_kobo, status")
    .eq("business_id", business.id)
    .in("id", productIds);

  if (productsError || !products) {
    console.error("[orders] product fetch failed", productsError);
    return { status: "error", error: "Could not load products." };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));
  const missing = submittedItems.filter((it) => !productsById.has(it.product_id));
  if (missing.length > 0) {
    return { status: "error", error: "Some products are no longer available.", fieldErrors: { items: "Re-pick the unavailable items" } };
  }

  let subtotalKobo = 0;
  const orderItemsToInsert: Array<{
    product_id: string;
    name_snapshot: string;
    price_kobo_snapshot: number;
    quantity: number;
    line_total_kobo: number;
  }> = [];

  for (const it of submittedItems) {
    const product = productsById.get(it.product_id);
    if (!product) continue;
    const lineTotal = product.price_kobo * it.quantity;
    subtotalKobo += lineTotal;
    orderItemsToInsert.push({
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: product.price_kobo,
      quantity: it.quantity,
      line_total_kobo: lineTotal,
    });
  }

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      source: "manual",
      status: "pending",
      subtotal_kobo: subtotalKobo,
      currency: "NGN",
      notes,
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    console.error("[orders] insert order failed", orderError);
    return { status: "error", error: "Could not create order: " + (orderError?.message ?? "unknown") };
  }

  const rowsWithOrderId = orderItemsToInsert.map((row) => ({ ...row, order_id: orderRow.id }));
  const { error: itemsInsertError } = await supabase.from("order_items").insert(rowsWithOrderId);

  if (itemsInsertError) {
    console.error("[orders] insert order_items failed", itemsInsertError);
    await supabase.from("orders").delete().eq("id", orderRow.id);
    return { status: "error", error: "Could not save order items: " + itemsInsertError.message };
  }

  revalidatePath("/dashboard/orders");
  redirect("/dashboard/orders");
}

export type OrderTransitionResult =
  | { ok: true }
  | { ok: false; error: string };

async function transitionOrderStatus(orderId: string, nextStatus: "paid" | "cancelled"): Promise<OrderTransitionResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business" };

  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };

  if (order.status === nextStatus) return { ok: true };
  if (order.status === "cancelled" && nextStatus === "paid") {
    return { ok: false, error: "Cannot mark a cancelled order as paid." };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: nextStatus })
    .eq("id", orderId)
    .eq("business_id", business.id);

  if (updateError) {
    console.error("[orders] transition failed", updateError);
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/orders/" + orderId);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markOrderPaidAction(orderId: string): Promise<OrderTransitionResult> {
  const result = await transitionOrderStatus(orderId, "paid");
  if (result.ok) {
    // Best-effort: auto-send the receipt to the customer. Never block the
    // mark-paid result on the messaging side effect.
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const proto = h.get("x-forwarded-proto") ?? "https";
      const origin = host ? proto + "://" + host : "https://1manbiz.vercel.app";
      const admin = createAdminClient();
      await sendReceiptForOrder(admin, { orderId, origin });
    } catch (e) {
      console.error("[orders] receipt auto-send after mark-paid failed", e);
    }
  }
  return result;
}

export async function cancelOrderAction(orderId: string): Promise<OrderTransitionResult> {
  return transitionOrderStatus(orderId, "cancelled");
}

export type CreateFromProposalResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

type ProposalItemInput = { productId: string; quantity: number };

/**
 * Create a pending order from an AI chat proposal (3H.2).
 *
 * Mirrors createOrderAction's write path exactly (auth -> business ->
 * re-resolve prices from catalog -> insert order + items -> orphan recovery)
 * but resolves the customer from the conversation instead of a form field,
 * and RETURNS the new order id instead of redirecting so the client panel can
 * navigate. The vendor confirms; this never touches payment. Client-supplied
 * prices are ignored entirely - only productId + quantity are trusted, and the
 * order is always created as pending.
 */
export async function createOrderFromProposalAction(input: {
  conversationId: string;
  items: ProposalItemInput[];
  notes?: string | null;
}): Promise<CreateFromProposalResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError || !business) {
    console.error("[orders] proposal: resolve business failed", businessError);
    return { ok: false, error: "No business found for this account." };
  }

  const conversationId = String(input.conversationId ?? "").trim();
  if (!conversationId) return { ok: false, error: "Missing conversation." };

  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .select("id, customer_id, contact_phone_e164")
    .eq("id", conversationId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (convoError) {
    console.error("[orders] proposal: convo lookup failed", convoError);
    return { ok: false, error: "Could not load the conversation." };
  }
  if (!convo) return { ok: false, error: "Conversation not found." };

  const submittedItems: ProposalItemInput[] = (Array.isArray(input.items) ? input.items : [])
    .filter((it) => it && typeof it === "object")
    .map((it) => ({
      productId: String(it.productId ?? ""),
      quantity: Math.max(1, Math.floor(Number(it.quantity ?? 0))),
    }))
    .filter((it) => it.productId && it.quantity > 0);

  if (submittedItems.length === 0) {
    return { ok: false, error: "Add at least one item before creating the order." };
  }

  let customerId: string | null = convo.customer_id ?? null;

  if (!customerId) {
    const phone = (convo.contact_phone_e164 ?? "").trim();
    if (!phone) {
      return { ok: false, error: "This chat has no linked customer yet. Open it once to link the contact, then retry." };
    }
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone_e164", phone)
      .maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: createdCustomer, error: custErr } = await supabase
        .from("customers")
        .insert({ business_id: business.id, name: phone, phone_e164: phone })
        .select("id")
        .single();
      if (custErr || !createdCustomer) {
        console.error("[orders] proposal: customer create failed", custErr);
        return { ok: false, error: "Could not link a customer for this order." };
      }
      customerId = createdCustomer.id;
    }
  }

  const productIds = submittedItems.map((it) => it.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price_kobo, status")
    .eq("business_id", business.id)
    .in("id", productIds);
  if (productsError || !products) {
    console.error("[orders] proposal: product fetch failed", productsError);
    return { ok: false, error: "Could not load products." };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));
  const missing = submittedItems.filter((it) => !productsById.has(it.productId));
  if (missing.length > 0) {
    return { ok: false, error: "Some products are no longer available. Re-draft and try again." };
  }

  let subtotalKobo = 0;
  const orderItemsToInsert: Array<{
    product_id: string;
    name_snapshot: string;
    price_kobo_snapshot: number;
    quantity: number;
    line_total_kobo: number;
  }> = [];

  for (const it of submittedItems) {
    const product = productsById.get(it.productId);
    if (!product) continue;
    const lineTotal = product.price_kobo * it.quantity;
    subtotalKobo += lineTotal;
    orderItemsToInsert.push({
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: product.price_kobo,
      quantity: it.quantity,
      line_total_kobo: lineTotal,
    });
  }

  const notes = (input.notes ?? "").toString().trim().slice(0, 1000) || null;

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      customer_id: customerId,
      source: "whatsapp_ai",
      status: "pending",
      subtotal_kobo: subtotalKobo,
      currency: "NGN",
      notes,
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    console.error("[orders] proposal: insert order failed", orderError);
    return { ok: false, error: "Could not create order: " + (orderError?.message ?? "unknown") };
  }

  const rowsWithOrderId = orderItemsToInsert.map((row) => ({ ...row, order_id: orderRow.id }));
  const { error: itemsInsertError } = await supabase.from("order_items").insert(rowsWithOrderId);

  if (itemsInsertError) {
    console.error("[orders] proposal: insert order_items failed", itemsInsertError);
    await supabase.from("orders").delete().eq("id", orderRow.id);
    return { ok: false, error: "Could not save order items: " + itemsInsertError.message };
  }

  console.log("[orders] proposal: created", { orderId: orderRow.id, items: orderItemsToInsert.length, subtotalKobo });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return { ok: true, orderId: orderRow.id };
}

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { initPaymentForOrder } from "@/lib/payments/init";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { formatNairaFromKobo } from "@/lib/format";
import { sendReceiptForOrder } from "@/lib/receipt-send";

export type SendPaymentLinkResult =
  | { ok: true; sent: boolean; url: string; reference: string }
  | { ok: false; error: string };

/**
 * Generate a Paystack payment link for a pending order and deliver it.
 *
 * If the order's customer has a WhatsApp conversation with a connected channel,
 * the link is auto-sent into that thread AS THE VENDOR (sender_role 'vendor') --
 * payment requests come from the business, not a bot. If there is no
 * conversation (e.g. a manually-created order), the link is returned for the
 * vendor to copy and share however they like.
 */
export async function sendPaymentLinkAction(
  orderId: string,
): Promise<SendPaymentLinkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? proto + "://" + host : "https://1manbiz.vercel.app";

  const init = await initPaymentForOrder(user.id, orderId, origin);
  if (!init.ok) return { ok: false, error: init.error };

  if (init.customerId) {
    const admin = createAdminClient();
    const { data: convo } = await admin
      .from("conversations")
      .select("id, contact_phone_e164, channel_account_id")
      .eq("customer_id", init.customerId)
      .maybeSingle();

    if (convo?.channel_account_id && convo.contact_phone_e164) {
      const { data: channel } = await admin
        .from("channel_accounts")
        .select("meta_phone_number_id, access_token, status")
        .eq("id", convo.channel_account_id)
        .maybeSingle();

      if (
        channel &&
        channel.status === "connected" &&
        channel.meta_phone_number_id &&
        channel.access_token
      ) {
        const message =
          "Here is your secure payment link for " +
          formatNairaFromKobo(init.amountKobo) +
          ":\n" +
          init.authorizationUrl;

        const sendResult = await sendWhatsAppText({
          phoneNumberId: channel.meta_phone_number_id,
          accessToken: channel.access_token,
          toE164: convo.contact_phone_e164,
          body: message,
        });

        if (sendResult.ok) {
          const sentAt = new Date().toISOString();
          await admin.from("messages").insert({
            conversation_id: convo.id,
            direction: "out",
            sender_role: "vendor",
            body_text: message,
            sent_at: sentAt,
            meta_message_id: sendResult.wamid,
            meta_status: "sent",
          });
          await admin
            .from("conversations")
            .update({
              last_message_at: sentAt,
              last_message_preview: "Payment link sent",
              last_message_direction: "out",
            })
            .eq("id", convo.id);

          revalidatePath("/dashboard/orders/" + orderId);
          return {
            ok: true,
            sent: true,
            url: init.authorizationUrl,
            reference: init.reference,
          };
        }
      }
    }
  }

  revalidatePath("/dashboard/orders/" + orderId);
  return {
    ok: true,
    sent: false,
    url: init.authorizationUrl,
    reference: init.reference,
  };
}
