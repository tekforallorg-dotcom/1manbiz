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

/**
 * Autonomous reply loop. Called from the WhatsApp webhook after a FRESH inbound
 * customer message is persisted. Never throws -- any failure is logged and
 * swallowed so the webhook always returns 200 to Meta.
 *
 * Guardrails:
 *  - Only acts when ai_mode = 'autonomous' (off/assisted/semi never auto-send).
 *  - Only sends high-confidence replies; low-confidence is left for the vendor.
 *  - Bookings: when the business offers them (service/hybrid), the model emits
 *    create/edit/cancel and the server executes it against the customer's next
 *    upcoming booking, then composes the confirmation from the stored row.
 *    It NEVER creates orders, marks paid, or sends payment links. Money is human.
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
function composeBookingConfirmation(title: string, iso: string): string {
  return 'Noted. I have pencilled in "' + title + '" for ' + whenLabel(iso) + ' (WAT). We will confirm shortly.';
}
function composeBookingUpdate(title: string, iso: string): string {
  return 'Updated. "' + title + '" is now set for ' + whenLabel(iso) + ' (WAT). We will confirm shortly.';
}
function composeBookingCancel(title: string): string {
  return 'Done. I have cancelled "' + title + '". Let us know if you would like to rebook.';
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

  // Booking capability: only service/hybrid businesses can take appointments.
  const businessType = (business.business_type as string | null) ?? "product";
  const offersBookings = businessType === "service" || businessType === "hybrid";

  // Channel must be connected with usable per-tenant credentials.
  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", channelAccountId)
    .maybeSingle();
  if (!channel || channel.status !== "connected") return;
  if (!channel.meta_phone_number_id || !channel.access_token) return;

  // Booking context: the customer for this conversation and their next upcoming
  // booking, so the model edits that one instead of creating a duplicate.
  let customerId: string | null = null;
  let currentBooking: { title: string; whenLabel: string } | null = null;
  if (offersBookings) {
    const { data: convo } = await admin
      .from("conversations")
      .select("customer_id")
      .eq("id", conversationId)
      .maybeSingle();
    customerId = (convo?.customer_id as string | null) ?? null;
    if (customerId) {
      const cb = await loadCurrentBooking(admin, businessId, customerId);
      if (cb) currentBooking = { title: cb.title, whenLabel: whenLabel(cb.starts_at) };
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
    apiKey, messages, catalog, deliveryZones, knowledgeItems, tone, language, offersBookings, currentBooking,
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
    extra?: { kind?: string; proposal?: Record<string, unknown> },
  ) => {
    try {
      await admin.from("ai_decisions").insert({
        business_id: businessId,
        conversation_id: conversationId,
        kind: extra?.kind ?? "reply",
        mode: "autonomous",
        model: REPLY_MODEL,
        input_message_count: messages.length,
        item_count: 0,
        confidence: result.confidence,
        proposal: extra?.proposal ?? { reply: result.reply, confidence: result.confidence },
        outcome,
        outcome_at: outcome === "auto_sent" ? new Date().toISOString() : null,
      });
    } catch (e) {
      console.error("[ai/auto-reply] decision log threw", e);
    }
  };

  if (!act) {
    await logDecision("pending");
    return;
  }

  // Booking action: create / edit / cancel, executed against this customer's
  // next upcoming booking. The reply is composed from the stored result so the
  // customer message always matches reality. Failures fall back to a safe ask,
  // never a fabricated confirmation.
  let bodyText = result.reply;
  let bookedDecision: { kind: string; proposal: Record<string, unknown> } | null = null;

  if (offersBookings && result.bookingAction && customerId) {
    const a = result.bookingAction;
    if (a.kind === "create") {
      const created = await createPendingBooking({
        admin, businessId, customerId, title: a.title || "Appointment", startsAtWatLocal: a.starts_at ?? "",
      });
      if (created.ok) {
        bodyText = composeBookingConfirmation(a.title || "Appointment", created.startsAtIso);
        bookedDecision = { kind: "booking", proposal: { action: "create_booking", booking_id: created.bookingId, starts_at: created.startsAtIso, title: a.title || "Appointment" } };
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
          bodyText = composeBookingUpdate(title, iso);
          bookedDecision = { kind: "booking", proposal: { action: "edit_booking", booking_id: current.id, starts_at: iso, title } };
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
          bookedDecision = { kind: "booking", proposal: { action: "cancel_booking", booking_id: current.id } };
        } else {
          console.warn("[ai/auto-reply] booking cancel failed", cancelled.error);
          bodyText = "I could not cancel that booking. Please try again shortly.";
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
    await logDecision("pending", bookedDecision ?? undefined);
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

  await logDecision("auto_sent", bookedDecision ?? undefined);
}
