import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { formatNairaFromKobo } from "@/lib/format";
import {
  draftReply,
  REPLY_MODEL,
  type ReplyCatalogProduct,
  type ReplyDeliveryZone,
  type ReplyKnowledgeItem,
  type ReplyLine,
} from "@/lib/ai/draft-reply";
import { shouldAutoSend, type AiMode } from "@/lib/ai/gate";
import { broadcastTyping } from "@/lib/realtime/typing";
import {
  createPendingBooking,
  loadCurrentBooking,
  editBooking,
  cancelBooking,
} from "@/lib/ai/actions/booking-actions";
import {
  loadCurrentOrder,
  createOrder,
  addItem,
  removeItem,
  setQuantity,
  cancelOrder,
  type OrderSnapshot,
  type EditOrderResult,
} from "@/lib/ai/actions/order-actions";

/**
 * Autonomous reply loop. Called from the WhatsApp webhook after a FRESH inbound
 * customer message is persisted. Never throws -- any failure is logged and
 * swallowed so the webhook always returns 200 to Meta.
 *
 * Guardrails:
 *  - Only acts when ai_mode = 'autonomous' (off/assisted/semi never auto-send).
 *  - Only sends high-confidence replies; low-confidence is left for the vendor.
 *  - Bookings (service/hybrid): create/edit/cancel against the customer's next
 *    upcoming booking. Orders (product/hybrid): create/add/remove/set-qty/cancel
 *    against the customer's one open pending order. Both compose the reply from
 *    the STORED result. Neither marks paid or sends a payment link. Money is human.
 *  - The reply is stored as sender_role 'ai' (excluded from future AI input).
 *  - Idempotency is the caller's responsibility (webhook only invokes on a
 *    fresh message insert), so retries do not double-reply.
 */

function whenLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}
// "Mon, 8 Jun at 14:00" for the customer-facing booking summary.
function whenLabelAt(iso: string): string {
  const d = new Date(iso);
  const datePart = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return datePart + " at " + timePart;
}
function composeBookingSummary(title: string, iso: string): string {
  return "Here is your booking: " + title + " on " + whenLabelAt(iso) + " (WAT). Would you like to confirm it, or change the day or time?";
}
function composeBookingUpdateSummary(title: string, iso: string): string {
  return "Updated. Here is your booking: " + title + " on " + whenLabelAt(iso) + " (WAT). Would you like to confirm it, or change the day or time?";
}
function composeBookingConfirmed(title: string, iso: string): string {
  return "Your booking is confirmed: " + title + " on " + whenLabelAt(iso) + " (WAT). We look forward to seeing you.";
}
function composeBookingDeclined(iso: string): string {
  return "Okay, no problem. Your booking for " + whenLabelAt(iso) + " (WAT) is saved, so just let us know whenever you are ready to confirm. Is there anything else I can help you with?";
}
function composeBookingCancel(title: string): string {
  return 'Done. I have cancelled "' + title + '". Let us know if you would like to rebook.';
}

function lineText(snap: OrderSnapshot): string {
  return snap.lines.map((l) => l.quantity + "x " + l.name).join(", ");
}
function orderLines(snap: OrderSnapshot): string {
  return snap.lines
    .map((l) => l.quantity + "x " + l.name + " - " + formatNairaFromKobo(l.line_total_kobo))
    .join("\n");
}
function composeOrderSummary(snap: OrderSnapshot): string {
  return "Here is your order:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo) +
    "\nWould you like to add anything else, or confirm your order?";
}
function composeOrderConfirmed(snap: OrderSnapshot): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo) +
    "\nWe will send you a payment link shortly.";
}
function composeOrderDeclined(): string {
  return "Okay, no problem. Your order is saved, so just let us know whenever you are ready to confirm. Is there anything else I can help you with?";
}

export async function maybeAutoReply(args: {
  businessId: string;
  conversationId: string;
  channelAccountId: string;
  toE164: string;
}): Promise<void> {
  const { businessId, conversationId, channelAccountId, toE164 } = args;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const admin = createAdminClient();

  // Mode gate first (cheapest check -- skip everything if not autonomous).
  const { data: business } = await admin
    .from("businesses")
    .select("id, ai_mode, ai_tone, ai_language, business_type")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return;
  const mode = (business.ai_mode as AiMode | null) ?? "assisted";
  if (mode !== "autonomous") return;

  // Capabilities from business_type. Service/hybrid take bookings; product/hybrid
  // take orders. A hybrid does both; a product-only shop never schedules.
  const businessType = (business.business_type as string | null) ?? "product";
  const offersBookings = businessType === "service" || businessType === "hybrid";
  const offersOrders = businessType === "product" || businessType === "hybrid";

  // Channel must be connected with usable per-tenant credentials.
  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", channelAccountId)
    .maybeSingle();
  if (!channel || channel.status !== "connected") return;
  if (!channel.meta_phone_number_id || !channel.access_token) return;

  // Transaction context: the conversation's customer, plus their current
  // booking and/or current open order, so the model edits the real entity
  // instead of inventing one. Database state is the truth fed to the model.
  let customerId: string | null = null;
  let currentBooking: { title: string; whenLabel: string } | null = null;
  let currentOrderForPrompt: { label: string } | null = null;
  if (offersBookings || offersOrders) {
    const { data: convo } = await admin
      .from("conversations")
      .select("customer_id")
      .eq("id", conversationId)
      .maybeSingle();
    customerId = (convo?.customer_id as string | null) ?? null;
    if (customerId && offersBookings) {
      const cb = await loadCurrentBooking(admin, businessId, customerId);
      if (cb) currentBooking = { title: cb.title, whenLabel: whenLabel(cb.starts_at) };
    }
    if (customerId && offersOrders) {
      const co = await loadCurrentOrder(admin, businessId, customerId);
      if (co && co.lines.length > 0) {
        currentOrderForPrompt = { label: lineText(co) + "; subtotal " + formatNairaFromKobo(co.subtotalKobo) };
      }
    }
  }

  // Grounding context (same shape as the draft-reply route).
  const { data: msgRows } = await admin
    .from("messages")
    .select("sender_role, body_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(40);
  const { data: prodRows } = await admin
    .from("products")
    .select("name, price_kobo, stock_quantity")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);
  const { data: zoneRows } = await admin
    .from("delivery_zones")
    .select("label, fee_kobo, note")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const { data: knowledgeRows } = await admin
    .from("knowledge_items")
    .select("title, content")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  const messages: ReplyLine[] = (msgRows ?? []).map((m) => ({
    sender_role: m.sender_role as ReplyLine["sender_role"],
    body_text: (m.body_text as string | null) ?? "",
  }));
  const catalog: ReplyCatalogProduct[] = (prodRows ?? []).map((p) => ({
    name: p.name as string,
    price_naira: formatNairaFromKobo(Number(p.price_kobo)),
    in_stock: Number(p.stock_quantity) > 0,
  }));
  const deliveryZones: ReplyDeliveryZone[] = (zoneRows ?? []).map((z) => ({
    label: z.label as string,
    fee_naira: formatNairaFromKobo(Number(z.fee_kobo)),
    note: (z.note as string | null) ?? null,
  }));
  const knowledgeItems: ReplyKnowledgeItem[] = (knowledgeRows ?? []).map((k) => ({
    title: k.title as string,
    content: k.content as string,
  }));

  const tone = (business.ai_tone as string | null) ?? "friendly";
  const language = (business.ai_language as string | null) ?? "en";

  // Real composing signal: dots appear for exactly the model's thinking time,
  // then clear the instant the draft is ready (the message follows on send).
  void broadcastTyping(conversationId, "start");
  const result = await draftReply({
    apiKey, messages, catalog, deliveryZones, knowledgeItems, tone, language,
    offersBookings, currentBooking, offersOrders, currentOrder: currentOrderForPrompt,
  });
  void broadcastTyping(conversationId, "stop");
  if (!result.ok) {
    console.error("[ai/auto-reply] draft failed", result.error);
    return;
  }

  // The trigger is a customer inbound that just arrived, so the 24h window is
  // open by construction.
  const act = shouldAutoSend({ mode, windowOpen: true, confidence: result.confidence });

  const logDecision = async (
    outcome: "auto_sent" | "pending",
    extra?: { kind?: string; proposal?: Record<string, unknown>; finalOrderId?: string; itemCount?: number },
  ) => {
    try {
      await admin.from("ai_decisions").insert({
        business_id: businessId,
        conversation_id: conversationId,
        kind: extra?.kind ?? "reply",
        mode: "autonomous",
        model: REPLY_MODEL,
        input_message_count: messages.length,
        item_count: extra?.itemCount ?? 0,
        confidence: result.confidence,
        proposal: extra?.proposal ?? { reply: result.reply, confidence: result.confidence },
        outcome,
        outcome_at: outcome === "auto_sent" ? new Date().toISOString() : null,
        final_order_id: extra?.finalOrderId ?? null,
      });
    } catch (e) {
      console.error("[ai/auto-reply] decision log threw", e);
    }
  };

  if (!act) {
    await logDecision("pending");
    return;
  }

  // Execute at most one transaction action, composing the reply from the stored
  // result. Booking takes precedence if both somehow fire; in practice the
  // latest message resolves to one intent. Failures fall back to a safe ask.
  let bodyText = result.reply;
  let actionDecision: { kind: string; proposal: Record<string, unknown>; finalOrderId?: string; itemCount?: number } | null = null;

  if (offersBookings && result.bookingAction && customerId) {
    const a = result.bookingAction;
    if (a.kind === "create") {
      const created = await createPendingBooking({
        admin, businessId, customerId, title: a.title || "Appointment", startsAtWatLocal: a.starts_at ?? "",
      });
      if (created.ok) {
        bodyText = composeBookingSummary(a.title || "Appointment", created.startsAtIso);
        actionDecision = { kind: "booking", proposal: { action: "create_booking", booking_id: created.bookingId, starts_at: created.startsAtIso, title: a.title || "Appointment" } };
      } else {
        console.warn("[ai/auto-reply] booking create failed", created.error);
        bodyText = "Could you confirm the exact day and time you would like to come in?";
      }
    } else if (a.kind === "edit") {
      const current = await loadCurrentBooking(admin, businessId, customerId);
      if (!current) {
        bodyText = "I do not see an upcoming booking to change. Would you like to make a new one?";
      } else {
        const edited = await editBooking(admin, { bookingId: current.id, startsAtWatLocal: a.starts_at, title: a.title });
        if (edited.ok) {
          const iso = edited.startsAtIso ?? current.starts_at;
          const title = edited.title ?? current.title;
          bodyText = composeBookingUpdateSummary(title, iso);
          actionDecision = { kind: "booking", proposal: { action: "edit_booking", booking_id: current.id, starts_at: iso, title } };
        } else {
          console.warn("[ai/auto-reply] booking edit failed", edited.error);
          bodyText = "I could not update that booking. Could you confirm the new day and time?";
        }
      }
    } else if (a.kind === "cancel") {
      const current = await loadCurrentBooking(admin, businessId, customerId);
      if (!current) {
        bodyText = "I do not see an upcoming booking to cancel.";
      } else {
        const cancelled = await cancelBooking(admin, current.id);
        if (cancelled.ok) {
          bodyText = composeBookingCancel(current.title);
          actionDecision = { kind: "booking", proposal: { action: "cancel_booking", booking_id: current.id } };
        } else {
          console.warn("[ai/auto-reply] booking cancel failed", cancelled.error);
          bodyText = "I could not cancel that booking. Please try again shortly.";
        }
      }
    } else if (a.kind === "confirm") {
      const current = await loadCurrentBooking(admin, businessId, customerId);
      if (!current) {
        bodyText = "I do not see a booking to confirm. Would you like to make one?";
      } else {
        bodyText = composeBookingConfirmed(current.title, current.starts_at);
        actionDecision = { kind: "booking", proposal: { action: "confirm_booking", booking_id: current.id } };
      }
    } else if (a.kind === "decline") {
      const current = await loadCurrentBooking(admin, businessId, customerId);
      if (!current) {
        bodyText = "No problem. Is there anything else I can help you with?";
      } else {
        bodyText = composeBookingDeclined(current.starts_at);
        actionDecision = { kind: "booking", proposal: { action: "decline_booking", booking_id: current.id } };
      }
    }
  } else if (offersOrders && result.orderAction && customerId) {
    const oa = result.orderAction;
    if (oa.kind === "create") {
      const created = await createOrder(admin, businessId, customerId, oa.items);
      if (created.ok) {
        bodyText = composeOrderSummary(created.order);
        actionDecision = { kind: "order_proposal", finalOrderId: created.order.orderId, itemCount: created.order.lines.length, proposal: { action: "create_order", order_id: created.order.orderId, subtotal_kobo: created.order.subtotalKobo, lines: created.order.lines } };
      } else if (created.code === "order_exists") {
        bodyText = "You already have an open order: " + lineText(created.order) + " (total " + formatNairaFromKobo(created.order.subtotalKobo) + "). Would you like to add to it, or cancel it and start a new one?";
      } else if (created.code === "unresolved") {
        bodyText = "I could not find " + created.names.join(", ") + " in our list. Could you pick the exact item from what we have?";
      } else if (created.code === "out_of_stock") {
        bodyText = created.names.join(", ") + " is out of stock right now, so I could not add it. Would you like something else from our list?";
      } else if (created.code === "empty") {
        bodyText = "What would you like to order?";
      } else {
        console.warn("[ai/auto-reply] order create failed", created.message);
        bodyText = "I could not start that order. Please try again shortly.";
      }
    } else {
      const current = await loadCurrentOrder(admin, businessId, customerId);
      if (!current) {
        bodyText = "You do not have an open order yet. What would you like to order?";
      } else if (oa.kind === "cancel") {
        const cancelled = await cancelOrder(admin, current.orderId);
        if (cancelled.ok) {
          bodyText = "Done. I have cancelled your order. Let us know if you would like to start a new one.";
          actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: 0, proposal: { action: "cancel_order", order_id: current.orderId } };
        } else {
          console.warn("[ai/auto-reply] order cancel failed", cancelled.error);
          bodyText = "I could not cancel that order. Please try again shortly.";
        }
      } else if (oa.kind === "confirm") {
        bodyText = composeOrderConfirmed(current);
        actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: current.lines.length, proposal: { action: "confirm_order", order_id: current.orderId, subtotal_kobo: current.subtotalKobo } };
      } else if (oa.kind === "decline") {
        bodyText = composeOrderDeclined();
        actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: current.lines.length, proposal: { action: "decline_order", order_id: current.orderId, subtotal_kobo: current.subtotalKobo } };
      } else {
        const item = oa.items[0];
        if (!item) {
          bodyText = "What would you like to change on your order?";
        } else {
          let res: EditOrderResult;
          if (oa.kind === "add_item") res = await addItem(admin, businessId, current.orderId, item);
          else if (oa.kind === "set_quantity") res = await setQuantity(admin, businessId, current.orderId, item);
          else res = await removeItem(admin, businessId, current.orderId, item.name);

          if (res.ok) {
            if (res.order.lines.length === 0) {
              bodyText = "Your order is now empty. Tell me what to add, or say cancel to drop it.";
              actionDecision = { kind: "order_proposal", finalOrderId: res.order.orderId, itemCount: 0, proposal: { action: oa.kind, order_id: res.order.orderId } };
            } else {
              bodyText = composeOrderSummary(res.order);
              actionDecision = { kind: "order_proposal", finalOrderId: res.order.orderId, itemCount: res.order.lines.length, proposal: { action: oa.kind, order_id: res.order.orderId, subtotal_kobo: res.order.subtotalKobo, lines: res.order.lines } };
            }
          } else if (res.code === "unresolved") {
            bodyText = "I could not find " + res.names.join(", ") + " in our list. Could you pick the exact item from what we have?";
          } else if (res.code === "out_of_stock") {
            bodyText = res.names.join(", ") + " is out of stock right now, so I could not add it. Would you like something else from our list?";
          } else if (res.code === "not_in_order") {
            bodyText = res.names.join(", ") + " is not on your current order. Would you like me to add it?";
          } else {
            console.warn("[ai/auto-reply] order edit failed", res.message);
            bodyText = "I could not update that order. Please try again shortly.";
          }
        }
      }
    }
  }

  const sendResult = await sendWhatsAppText({
    phoneNumberId: channel.meta_phone_number_id,
    accessToken: channel.access_token,
    toE164,
    body: bodyText,
  });
  if (!sendResult.ok) {
    console.error("[ai/auto-reply] send failed", sendResult.error);
    await logDecision("pending", actionDecision ?? undefined);
    return;
  }

  const sentAt = new Date().toISOString();
  const preview = bodyText.slice(0, 80);

  await admin.from("messages").insert({
    conversation_id: conversationId,
    direction: "out",
    sender_role: "ai",
    body_text: bodyText,
    sent_at: sentAt,
    meta_message_id: sendResult.wamid,
    meta_status: "sent",
  });

  await admin
    .from("conversations")
    .update({
      last_message_at: sentAt,
      last_message_preview: preview,
      last_message_direction: "out",
    })
    .eq("id", conversationId);

  await logDecision("auto_sent", actionDecision ?? undefined);
}
