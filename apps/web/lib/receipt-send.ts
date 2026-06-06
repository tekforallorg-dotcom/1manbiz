import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { buildReceiptUrl, buildReceiptWhatsAppMessage } from "@/lib/receipt";

/**
 * Auto-send the paid receipt to the customer on WhatsApp, exactly once.
 *
 * This is a transactional notification, not an AI decision: it is tied to the
 * paid transition and is independent of ai_mode. Call it from any server path
 * that marks an order paid (the Paystack webhook, the mark-paid server action).
 *
 * Self-guarding and best-effort:
 *   - Returns { sent: false, reason } and never throws on the expected misses
 *     (not paid yet, no receipt_code, already sent, no connected WhatsApp
 *     thread, or Meta rejecting because the 24h session window is closed).
 *   - Stamps orders.receipt_sent_at only after a successful send, so retries
 *     and a second mark-paid across paths do not double-send.
 *
 * Known limitation: two duplicate webhook deliveries arriving within the same
 * few milliseconds could both pass the receipt_sent_at guard before either
 * stamps it. In practice the webhook already-paid early return makes this
 * vanishingly rare; a claim-before-send guard is a later hardening if needed.
 */
type AdminClient = ReturnType<typeof createAdminClient>;

export type SendReceiptResult =
  | { sent: true; wamid: string }
  | {
      sent: false;
      reason:
        | "not_paid"
        | "no_receipt_code"
        | "already_sent"
        | "no_channel"
        | "send_failed"
        | "error";
      detail?: string;
    };

type NameRel = { name?: string | null } | { name?: string | null }[] | null;

function pickName(rel: NameRel): string | null {
  if (!rel) return null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  return row?.name ?? null;
}

type OrderRow = {
  status: string;
  receipt_code: string | null;
  customer_id: string | null;
  receipt_sent_at: string | null;
  businesses: NameRel;
  customers: NameRel;
};

export async function sendReceiptForOrder(
  admin: AdminClient,
  args: { orderId: string; origin: string },
): Promise<SendReceiptResult> {
  const { orderId, origin } = args;

  const { data, error: orderErr } = await admin
    .from("orders")
    .select(
      "status, receipt_code, customer_id, receipt_sent_at, businesses(name), customers(name)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !data) {
    console.error("[receipt-send] order load failed", { orderId, error: orderErr });
    return { sent: false, reason: "error", detail: orderErr?.message };
  }

  const order = data as unknown as OrderRow;

  if (order.status !== "paid") return { sent: false, reason: "not_paid" };
  if (!order.receipt_code) return { sent: false, reason: "no_receipt_code" };
  if (order.receipt_sent_at) return { sent: false, reason: "already_sent" };
  if (!order.customer_id) return { sent: false, reason: "no_channel" };

  const businessName = pickName(order.businesses) ?? "the shop";
  const customerName = pickName(order.customers) ?? "there";

  const { data: convo } = await admin
    .from("conversations")
    .select("id, contact_phone_e164, channel_account_id")
    .eq("customer_id", order.customer_id)
    .maybeSingle();

  if (!convo || !convo.channel_account_id || !convo.contact_phone_e164) {
    return { sent: false, reason: "no_channel" };
  }

  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", convo.channel_account_id)
    .maybeSingle();

  if (
    !channel ||
    channel.status !== "connected" ||
    !channel.meta_phone_number_id ||
    !channel.access_token
  ) {
    return { sent: false, reason: "no_channel" };
  }

  const receiptUrl = buildReceiptUrl(origin, order.receipt_code);
  const message = buildReceiptWhatsAppMessage({ businessName, customerName, receiptUrl });

  const sendResult = await sendWhatsAppText({
    phoneNumberId: channel.meta_phone_number_id,
    accessToken: channel.access_token,
    toE164: convo.contact_phone_e164,
    body: message,
  });

  if (!sendResult.ok) {
    console.error("[receipt-send] whatsapp send failed", { orderId, error: sendResult.error });
    return { sent: false, reason: "send_failed", detail: sendResult.error };
  }

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
      last_message_preview: "Receipt sent",
      last_message_direction: "out",
    })
    .eq("id", convo.id);

  await admin
    .from("orders")
    .update({ receipt_sent_at: sentAt })
    .eq("id", orderId);

  return { sent: true, wamid: sendResult.wamid };
}
