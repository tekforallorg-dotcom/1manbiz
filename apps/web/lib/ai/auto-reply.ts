import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText, sendWhatsAppImage, sendTypingIndicator } from "@/lib/whatsapp/send";
import { getProductImageUrl } from "@/lib/storage";
import { formatNairaFromKobo } from "@/lib/format";
import {
  draftReply,
  REPLY_MODEL,
  type ReplyDeliveryZone,
  type ReplyKnowledgeItem,
  type ReplyLine,
} from "@/lib/ai/draft-reply";
import { buildReplyCatalog } from "@/lib/ai/catalog";
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
  markConfirmed,
  setFulfillment,
  setDeliveryArea,
  setPaymentMethod,
  setPickupAt,
  resolveActiveProduct,
  fetchActiveVariants,
  matchVariant,
  type OrderSnapshot,
  type EditOrderResult,
} from "@/lib/ai/actions/order-actions";
import { initPaymentForBusinessOrder } from "@/lib/payments/init";
import { notifyOwnerOrderConfirmed } from "@/lib/ai/owner/alerts";

// Low-confidence fallback lines. When the model is not confident, we send one of
// these at random (instead of going silent) to invite the customer to restate.
// Varied wording so repeated low-confidence turns do not read like a stuck bot.
const CLARIFIERS: readonly [string, string, string] = [
  "Sorry, I did not quite catch that. Could you say it another way, or tell me what you would like to order or ask about?",
  "I want to make sure I get this right. Could you share a little more detail about what you need?",
  "I am not sure I understood that fully. Could you rephrase it for me?",
];

function pickClarifier(): string {
  return CLARIFIERS[Math.floor(Math.random() * CLARIFIERS.length)] ?? CLARIFIERS[0];
}

/**
 * Autonomous reply loop. Called from the WhatsApp webhook after a FRESH inbound
 * customer message is persisted. Never throws -- any failure is logged and
 * swallowed so the webhook always returns 200 to Meta.
 *
 * Guardrails:
 *  - Only acts when ai_mode = 'autonomous' (off/assisted/semi never auto-send).
 *  - High-confidence replies are sent in full; low-confidence sends a short
 *    clarifier asking the customer to restate (never a money action).
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
  return "In your cart:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo) +
    "\nAnything else, or should I confirm your order?";
}

// One photo per distinct product in an order, captioned with name and price,
// for the confirmation moment. Reads order_items -> products directly so the
// OrderSnapshot type stays unchanged. Products without an image are skipped.
interface ProductPhoto {
  productId: string;
  imageUrl: string;
  caption: string;
}
async function fetchOrderProductPhotos(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string,
): Promise<ProductPhoto[]> {
  const { data, error } = await admin
    .from("order_items")
    .select("product_id, name_snapshot, variant_label_snapshot, price_kobo_snapshot, products(image_path)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const seen = new Set<string>();
  const photos: ProductPhoto[] = [];
  for (const row of data as Array<Record<string, unknown>>) {
    const productId = (row.product_id as string | null) ?? null;
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    const prod = row.products as { image_path?: string | null } | { image_path?: string | null }[] | null;
    const imagePath = Array.isArray(prod)
      ? (prod[0]?.image_path ?? null)
      : (prod?.image_path ?? null);
    const imageUrl = getProductImageUrl(imagePath);
    if (!imageUrl) continue;
    const baseName = (row.name_snapshot as string | null) ?? "Item";
    const vlabel = (row.variant_label_snapshot as string | null) ?? null;
    const price = Number(row.price_kobo_snapshot ?? 0);
    const caption = (vlabel ? baseName + " - " + vlabel : baseName) + " - " + formatNairaFromKobo(price);
    photos.push({ productId, imageUrl, caption });
  }
  return photos;
}

// Product photos already sent to this customer in this conversation, so a
// product is photographed once (the first time it enters the order) and not
// re-sent on every held-order recompose.
async function loadShownProductIds(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from("conversation_shown_photos")
    .select("product_id")
    .eq("conversation_id", conversationId);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ product_id: string }>) set.add(r.product_id);
  return set;
}
async function recordShownProductIds(
  admin: ReturnType<typeof createAdminClient>,
  conversationId: string,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;
  const rows = productIds.map((pid) => ({ conversation_id: conversationId, product_id: pid }));
  await admin
    .from("conversation_shown_photos")
    .upsert(rows, { onConflict: "conversation_id,product_id" });
}

// Resolve a "show me a pic of X" request to a single product photo. Variants
// share the product image, so the photo is the product image captioned with the
// chosen variant label and its price. Null when there is nothing safe to show:
// the product is unknown, has no image, is out of stock, or has Options the
// customer has not chosen yet (the brain asks which option in that case).
async function resolveShowProductPhoto(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  name: string,
  variant: string | null,
): Promise<ProductPhoto | null> {
  const product = await resolveActiveProduct(admin, businessId, name);
  if (!product) return null;
  const { data: prow } = await admin
    .from("products")
    .select("image_path")
    .eq("id", product.id)
    .maybeSingle();
  const imagePath = ((prow as { image_path?: string | null } | null)?.image_path) ?? null;
  const imageUrl = getProductImageUrl(imagePath);
  if (!imageUrl) return null;

  let label: string | null = null;
  let priceKobo = product.price_kobo;
  let inStock = product.stock_quantity > 0;
  const variants = await fetchActiveVariants(admin, product.id, product.price_kobo);
  if (variants.length > 0) {
    if (!variant) return null;
    const v = matchVariant(variants, variant);
    if (!v) return null;
    label = v.label;
    priceKobo = v.price_kobo;
    inStock = v.stock_quantity > 0;
  }
  if (!inStock) return null;

  const caption = (label ? product.name + " - " + label : product.name) +
    " - " + formatNairaFromKobo(priceKobo);
  return { productId: product.id, imageUrl, caption };
}

function composeOrderConfirmed(snap: OrderSnapshot): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo) +
    "\nWe will send you a payment link shortly.";
}
function composeTotalsBlock(snap: OrderSnapshot): string {
  if (snap.deliveryFeeKobo > 0) {
    return "Goods: " + formatNairaFromKobo(snap.subtotalKobo) +
      "\nDelivery: " + formatNairaFromKobo(snap.deliveryFeeKobo) +
      "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo + snap.deliveryFeeKobo);
  }
  return "Total: " + formatNairaFromKobo(snap.subtotalKobo);
}
function composeFulfillmentQuestion(snap: OrderSnapshot): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo) +
    "\n\nWould you like delivery, or pickup from our store?";
}
function composeConfirmedHeader(snap: OrderSnapshot): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\nTotal: " + formatNairaFromKobo(snap.subtotalKobo);
}
function composePickupHolding(storeAddress: string): string {
  const intro = storeAddress
    ? "Great, you can pick up from our store at " + storeAddress + "."
    : "Great, you can pick up from our store.";
  return intro + " The shop will arrange your pickup time with you shortly.";
}
function composePickupTimeQuestion(storeAddress: string): string {
  const at = storeAddress ? " from our store at " + storeAddress : " from our store";
  return "Great. What day and time would you like to pick up" + at + "?";
}
function composeOrderConfirmedWithLink(snap: OrderSnapshot, url: string): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\n" + composeTotalsBlock(snap) +
    "\n\nPay securely here:\n" + url +
    "\nYour receipt is sent automatically once payment is confirmed.";
}
function composeOrderConfirmedOnDelivery(snap: OrderSnapshot): string {
  return "Your order is confirmed for delivery" + (snap.deliveryAddress ? " to " + snap.deliveryAddress : "") + ":\n" +
    orderLines(snap) + "\n" + composeTotalsBlock(snap) +
    "\nPayable on delivery. We will reach out to arrange delivery.";
}
function composeOrderConfirmedPayElsewhere(snap: OrderSnapshot): string {
  return "Your order is confirmed:\n" + orderLines(snap) + "\n" + composeTotalsBlock(snap) +
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
  origin: string;
  inboundMessageId?: string | null;
}): Promise<void> {
  const { businessId, conversationId, channelAccountId, toE164, origin } = args;
  const inboundMessageId = args.inboundMessageId ?? null;
  // When set, the reply being sent is a held-order presentation; we send one
  // product photo per distinct product just before the text. Best-effort.
  let photosForOrderId: string | null = null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const admin = createAdminClient();

  // Mode gate first (cheapest check -- skip everything if not autonomous).
  const { data: business } = await admin
    .from("businesses")
    .select("id, ai_mode, ai_tone, ai_language, business_type, ai_sends_payment_link, fulfillment_mode, address")
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
  const aiSendsPaymentLink = business.ai_sends_payment_link === true;
  const fulfillmentMode = (business.fulfillment_mode as string | null) ?? "both";
  const storeAddress = ((business.address as string | null) ?? "").trim();
  const pickupNextLine = () =>
    offersBookings ? composePickupTimeQuestion(storeAddress) : composePickupHolding(storeAddress);

  // Channel must be connected with usable per-tenant credentials.
  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", channelAccountId)
    .maybeSingle();
  if (!channel || channel.status !== "connected") return;
  if (!channel.meta_phone_number_id || !channel.access_token) return;

  // Show the customer a typing indicator while the brain works. Best-effort,
  // mirrors owner-mode; Meta clears it when our reply lands.
  if (inboundMessageId) {
    await sendTypingIndicator({
      phoneNumberId: channel.meta_phone_number_id,
      accessToken: channel.access_token,
      messageId: inboundMessageId,
    });
  }

  // Transaction context: the conversation's customer, plus their current
  // booking and/or current open order, so the model edits the real entity
  // instead of inventing one. Database state is the truth fed to the model.
  let customerId: string | null = null;
  let currentBooking: { title: string; whenLabel: string } | null = null;
  let currentOrderForPrompt: {
    label: string;
    confirmed: boolean;
    fulfillmentType: "delivery" | "pickup" | null;
    deliveryLabel: string | null;
    awaiting: "items" | "fulfillment" | "delivery_area" | "payment_method" | "pickup_time" | "complete";
  } | null = null;
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
        let awaiting: "items" | "fulfillment" | "delivery_area" | "payment_method" | "pickup_time" | "complete" = "items";
        if (aiSendsPaymentLink && co.confirmedAt) {
          if (!co.fulfillmentType) awaiting = "fulfillment";
          else if (co.fulfillmentType === "pickup") {
            if (!offersBookings) awaiting = "complete";
            else if (!co.pickupAt) awaiting = "pickup_time";
            else if (!co.paymentMethod) awaiting = "payment_method";
            else awaiting = "complete";
          } else if (co.fulfillmentType === "delivery" && !co.deliveryZoneId) awaiting = "delivery_area";
          else if (!co.paymentMethod) awaiting = "payment_method";
          else awaiting = "complete";
        }
        currentOrderForPrompt = {
          label: lineText(co) + "; subtotal " + formatNairaFromKobo(co.subtotalKobo),
          confirmed: !!co.confirmedAt,
          fulfillmentType: co.fulfillmentType,
          deliveryLabel: co.deliveryAddress,
          awaiting,
        };
      }
    }
  }

  // Grounding context (same shape as the draft-reply route).
  const { data: msgRows } = await admin
    .from("messages")
    .select("sender_role, body_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(40);
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

  const messages: ReplyLine[] = [...(msgRows ?? [])].reverse().map((m) => ({
    sender_role: m.sender_role as ReplyLine["sender_role"],
    body_text: (m.body_text as string | null) ?? "",
  }));
  const catalog = await buildReplyCatalog(businessId);
  const deliveryZones: ReplyDeliveryZone[] = (zoneRows ?? []).map((z) => ({
    label: z.label as string,
    fee_naira: formatNairaFromKobo(Number(z.fee_kobo)),
    note: (z.note as string | null) ?? null,
  }));
  const knowledgeItems: ReplyKnowledgeItem[] = (knowledgeRows ?? []).map((k) => ({
    title: k.title as string,
    content: k.content as string,
  }));

  // Last few completed orders, so the model can answer "my last paid order".
  let recentPaidOrders: string | null = null;
  if (offersOrders && customerId) {
    const { data: paidRows } = await admin
      .from("orders")
      .select("subtotal_kobo, receipt_code, paid_at, order_items(name_snapshot, quantity)")
      .eq("business_id", businessId)
      .eq("customer_id", customerId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(3);
    type PaidRow = {
      subtotal_kobo: number;
      receipt_code: string | null;
      paid_at: string | null;
      order_items: Array<{ name_snapshot: string | null; quantity: number | null }> | null;
    };
    const fmtDate = (iso: string) =>
      new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
    const paidLines = ((paidRows ?? []) as unknown as PaidRow[]).map((o, idx) => {
      const itemsText =
        (o.order_items ?? [])
          .map((i) => (i.quantity ?? 1) + "x " + (i.name_snapshot ?? "item"))
          .join(", ") || "order";
      const code = o.receipt_code ?? "n/a";
      const when = o.paid_at ? ", paid " + fmtDate(o.paid_at) : "";
      const tag = idx === 0 ? " (most recent paid order)" : "";
      return (idx + 1) + ". " + itemsText + ", total " + formatNairaFromKobo(Number(o.subtotal_kobo)) + ", receipt " + code + when + tag;
    });
    if (paidLines.length > 0) recentPaidOrders = paidLines.join("\n");
  }

  const tone = (business.ai_tone as string | null) ?? "friendly";
  const language = (business.ai_language as string | null) ?? "en";

  // Real composing signal: dots appear for exactly the model's thinking time,
  // then clear the instant the draft is ready (the message follows on send).
  void broadcastTyping(conversationId, "start");
  const result = await draftReply({
    apiKey, messages, catalog, deliveryZones, knowledgeItems, tone, language,
    offersBookings, currentBooking, offersOrders, currentOrder: currentOrderForPrompt,
    aiSendsPaymentLink,
    recentPaidOrders,
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
    // Low confidence: instead of going silent, send a short clarifier asking the
    // customer to restate. No action is executed and no money decision is made on
    // a low-confidence turn, so this is a safe nudge, not an answer.
    const clarifier = pickClarifier();
    const clarifierSend = await sendWhatsAppText({
      phoneNumberId: channel.meta_phone_number_id,
      accessToken: channel.access_token,
      toE164,
      body: clarifier,
    });
    if (!clarifierSend.ok) {
      console.error("[ai/auto-reply] clarifier send failed", clarifierSend.error);
      await logDecision("pending");
      return;
    }
    const clarifierAt = new Date().toISOString();
    await admin.from("messages").insert({
      conversation_id: conversationId,
      direction: "out",
      sender_role: "ai",
      body_text: clarifier,
      sent_at: clarifierAt,
      meta_message_id: clarifierSend.wamid,
      meta_status: "sent",
    });
    await admin
      .from("conversations")
      .update({
        last_message_at: clarifierAt,
        last_message_preview: clarifier.slice(0, 80),
        last_message_direction: "out",
      })
      .eq("id", conversationId);
    await logDecision("auto_sent", { proposal: { fallback: "clarifier", reply: clarifier, confidence: result.confidence } });
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
        photosForOrderId = created.order.orderId;
        actionDecision = { kind: "order_proposal", finalOrderId: created.order.orderId, itemCount: created.order.lines.length, proposal: { action: "create_order", order_id: created.order.orderId, subtotal_kobo: created.order.subtotalKobo, lines: created.order.lines } };
      } else if (created.code === "order_exists") {
        bodyText = "You already have an open order: " + lineText(created.order) + " (total " + formatNairaFromKobo(created.order.subtotalKobo) + "). Would you like to add to it, or cancel it and start a new one?";
      } else if (created.code === "unresolved") {
        bodyText = "I could not find " + created.names.join(", ") + " in our list. Could you pick the exact item from what we have?";
      } else if (created.code === "out_of_stock") {
        bodyText = created.names.join(", ") + " is out of stock right now, so I could not add it. Would you like something else from our list?";
      } else if (created.code === "needs_variant") {
        bodyText = created.names
          .map((n) => {
            const axes = catalog.find((c) => c.name === n)?.options?.join(" and ");
            return n + " comes in different " + (axes ? axes + " options" : "options");
          })
          .join("; ") + ". Which one would you like?";
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
          bodyText = "Done, your cart is now empty. Let us know if you would like to start a new one.";
          actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: 0, proposal: { action: "cancel_order", order_id: current.orderId } };
        } else {
          console.warn("[ai/auto-reply] order cancel failed", cancelled.error);
          bodyText = "I could not cancel that order. Please try again shortly.";
        }
      } else if (oa.kind === "show_cart") {
        bodyText = composeOrderSummary(current);
      } else if (oa.kind === "confirm") {
        if (!aiSendsPaymentLink) {
          bodyText = composeOrderConfirmed(current);
          actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: current.lines.length, proposal: { action: "confirm_order", order_id: current.orderId, subtotal_kobo: current.subtotalKobo } };
        } else if (fulfillmentMode === "delivery") {
          await markConfirmed(admin, current.orderId);
          const snap = await setFulfillment(admin, current.orderId, "delivery");
          bodyText = composeConfirmedHeader(snap) + "\n\nSure. Which area should we deliver to?";
          actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "confirm_order", order_id: snap.orderId, subtotal_kobo: snap.subtotalKobo, fulfillment_type: "delivery", awaiting: "delivery_area" } };
        } else if (fulfillmentMode === "pickup") {
          await markConfirmed(admin, current.orderId);
          const snap = await setFulfillment(admin, current.orderId, "pickup");
          bodyText = composeConfirmedHeader(snap) + "\n\n" + pickupNextLine();
          actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "confirm_order", order_id: snap.orderId, subtotal_kobo: snap.subtotalKobo, fulfillment_type: "pickup", awaiting: offersBookings ? "pickup_time" : "complete" } };
        } else {
          const snap = await markConfirmed(admin, current.orderId);
          bodyText = composeFulfillmentQuestion(snap);
          actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "confirm_order", order_id: snap.orderId, subtotal_kobo: snap.subtotalKobo, awaiting: "fulfillment" } };
        }
      } else if (oa.kind === "set_fulfillment") {
        if (!current.confirmedAt) {
          bodyText = composeOrderSummary(current);
          photosForOrderId = current.orderId;
        } else {
          const wanted = oa.fulfillment === "pickup" ? "pickup" : "delivery";
          if (wanted === "pickup" && fulfillmentMode === "delivery") {
            bodyText = "We do not offer pickup at the moment, only delivery. Which area should we deliver to?";
          } else if (wanted === "delivery" && fulfillmentMode === "pickup") {
            bodyText = "We do not offer delivery at the moment, only pickup. " + pickupNextLine();
          } else {
            const snap = await setFulfillment(admin, current.orderId, wanted);
            if (wanted === "delivery") {
              bodyText = "Sure. Which area should we deliver to?";
            } else {
              bodyText = pickupNextLine();
            }
            actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_fulfillment", order_id: snap.orderId, fulfillment_type: wanted } };
          }
        }
      } else if (oa.kind === "set_pickup_time") {
        if (!current.confirmedAt || current.fulfillmentType !== "pickup") {
          bodyText = composeOrderSummary(current);
          photosForOrderId = current.orderId;
        } else if (!customerId) {
          bodyText = composePickupTimeQuestion(storeAddress);
        } else {
          const booking = await createPendingBooking({
            admin,
            businessId,
            customerId,
            title: "Pickup - " + lineText(current),
            startsAtWatLocal: oa.pickup_at ?? "",
            orderId: current.orderId,
          });
          if (!booking.ok) {
            bodyText = "I could not read that time. What day and time would you like to pick up?";
          } else {
            const snap = await setPickupAt(admin, current.orderId, booking.startsAtIso);
            bodyText = "Your pickup is booked for " + whenLabelAt(booking.startsAtIso) + " (WAT)" +
              (storeAddress ? " at " + storeAddress : "") + ".\n" + orderLines(snap) + "\n" + composeTotalsBlock(snap) +
              "\n\nWould you like to pay online now, or pay at the store when you collect?";
            actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_pickup_time", order_id: snap.orderId, pickup_at: booking.startsAtIso, booking_id: booking.bookingId } };
          }
        }
      } else if (oa.kind === "set_delivery_area") {
        if (!current.confirmedAt) {
          bodyText = composeOrderSummary(current);
          photosForOrderId = current.orderId;
        } else {
          const res = await setDeliveryArea(admin, businessId, current.orderId, oa.area ?? "");
          if (res.ok) {
            bodyText = "Delivery to " + res.zoneLabel + " is " + formatNairaFromKobo(res.feeKobo) + "." +
              "\nGoods: " + formatNairaFromKobo(res.order.subtotalKobo) +
              "\nDelivery: " + formatNairaFromKobo(res.order.deliveryFeeKobo) +
              "\nTotal: " + formatNairaFromKobo(res.order.subtotalKobo + res.order.deliveryFeeKobo) +
              "\n\nWould you like to pay online now, or pay on delivery?";
            actionDecision = { kind: "order_proposal", finalOrderId: res.order.orderId, itemCount: res.order.lines.length, proposal: { action: "set_delivery_area", order_id: res.order.orderId, zone: res.zoneLabel, delivery_fee_kobo: res.feeKobo } };
          } else if (res.code === "no_match") {
            const areas = res.zones.map((z) => z.label).join(", ");
            bodyText = areas
              ? "We do not deliver to that area. We currently deliver to: " + areas + ". Which of these works for you?"
              : "We do not have delivery areas set up right now. Would you like to pick up from our store instead?";
          } else {
            console.warn("[ai/auto-reply] set delivery area failed", res.message);
            bodyText = "I could not set that delivery area. Please try again shortly.";
          }
        }
      } else if (oa.kind === "set_payment_method") {
        if (!current.confirmedAt) {
          bodyText = composeOrderSummary(current);
          photosForOrderId = current.orderId;
        } else {
          const method = oa.payment_method === "on_delivery" ? "on_delivery" : oa.payment_method === "at_store" ? "at_store" : "online";
          const snap = await setPaymentMethod(admin, current.orderId, method);
          if (method === "online") {
            const pay = await initPaymentForBusinessOrder(businessId, snap.orderId, origin);
            if (pay.ok) {
              bodyText = composeOrderConfirmedWithLink(snap, pay.authorizationUrl);
              actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_payment_method", order_id: snap.orderId, payment_method: "online", payment_link_sent: true, payment_reference: pay.reference } };
            } else {
              console.warn("[ai/auto-reply] payment link init failed", { orderId: snap.orderId, error: pay.error });
              bodyText = composeOrderConfirmedPayElsewhere(snap);
              actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_payment_method", order_id: snap.orderId, payment_method: "online", payment_link_sent: false } };
            }
          } else if (method === "on_delivery") {
            bodyText = composeOrderConfirmedOnDelivery(snap);
            actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_payment_method", order_id: snap.orderId, payment_method: "on_delivery" } };
          } else {
            bodyText = "Your order is reserved for pickup:\n" + orderLines(snap) + "\n" + composeTotalsBlock(snap) +
              "\nPay at the store when you collect.";
            actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "set_payment_method", order_id: snap.orderId, payment_method: "at_store" } };
          }
        }
      } else if (oa.kind === "decline") {
        bodyText = composeOrderDeclined();
        actionDecision = { kind: "order_proposal", finalOrderId: current.orderId, itemCount: current.lines.length, proposal: { action: "decline_order", order_id: current.orderId, subtotal_kobo: current.subtotalKobo } };
      } else if (oa.kind === "replace_item") {
        const fromItem = oa.items[0];
        const toItem = oa.items[1];
        if (!fromItem || !toItem) {
          bodyText = "What would you like to change, and to what?";
        } else {
          const added = await addItem(admin, businessId, current.orderId, toItem);
          if (!added.ok) {
            if (added.code === "unresolved") {
              bodyText = "I could not find " + added.names.join(", ") + " in our list. Could you pick the exact item from what we have?";
            } else if (added.code === "out_of_stock") {
              bodyText = added.names.join(", ") + " is out of stock right now, so I could not make that change. Would you like something else from our list?";
            } else if (added.code === "needs_variant") {
              bodyText = added.names
                .map((n) => {
                  const axes = catalog.find((c) => c.name === n)?.options?.join(" and ");
                  return n + " comes in different " + (axes ? axes + " options" : "options");
                })
                .join("; ") + ". Which one would you like?";
            } else {
              console.warn("[ai/auto-reply] replace add failed", added);
              bodyText = "I could not make that change. Please try again shortly.";
            }
          } else {
            const removed = await removeItem(admin, businessId, current.orderId, fromItem.name);
            const snap = removed.ok ? removed.order : added.order;
            bodyText = composeOrderSummary(snap);
            photosForOrderId = snap.orderId;
            actionDecision = { kind: "order_proposal", finalOrderId: snap.orderId, itemCount: snap.lines.length, proposal: { action: "replace_item", order_id: snap.orderId, subtotal_kobo: snap.subtotalKobo, lines: snap.lines } };
          }
        }
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
              photosForOrderId = res.order.orderId;
              actionDecision = { kind: "order_proposal", finalOrderId: res.order.orderId, itemCount: res.order.lines.length, proposal: { action: oa.kind, order_id: res.order.orderId, subtotal_kobo: res.order.subtotalKobo, lines: res.order.lines } };
            }
          } else if (res.code === "unresolved") {
            bodyText = "I could not find " + res.names.join(", ") + " in our list. Could you pick the exact item from what we have?";
          } else if (res.code === "out_of_stock") {
            bodyText = res.names.join(", ") + " is out of stock right now, so I could not add it. Would you like something else from our list?";
          } else if (res.code === "needs_variant") {
            bodyText = res.names
              .map((n) => {
                const axes = catalog.find((c) => c.name === n)?.options?.join(" and ");
                return n + " comes in different " + (axes ? axes + " options" : "options");
              })
              .join("; ") + ". Which one would you like?";
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

  // Resolve an explicit "show me a pic of X" request to one product photo.
  let showPhoto: ProductPhoto | null = null;
  if (offersOrders && result.showProduct) {
    try {
      showPhoto = await resolveShowProductPhoto(
        admin,
        businessId,
        result.showProduct.name,
        result.showProduct.variant ?? null,
      );
    } catch (e) {
      console.warn("[ai/auto-reply] show product resolve failed", e);
    }
  }

  // Send product photos best-effort, before the text, and never block it. Two
  // sources, mutually exclusive in practice: a held-order presentation sends one
  // photo per distinct product but only the first time each appears in the
  // conversation; an explicit show request always sends that one photo. The
  // order flow wins if both somehow fire on the same turn. Only successfully
  // sent photos are recorded, so a failed send retries next turn.
  try {
    let toSend: ProductPhoto[] = [];
    let respectShownSet = true;
    if (photosForOrderId) {
      toSend = await fetchOrderProductPhotos(admin, photosForOrderId);
    } else if (showPhoto) {
      toSend = [showPhoto];
      respectShownSet = false;
    }
    if (toSend.length > 0) {
      if (respectShownSet) {
        const shown = await loadShownProductIds(admin, conversationId);
        toSend = toSend.filter((p) => !shown.has(p.productId));
      }
      const sent: string[] = [];
      for (const photo of toSend) {
        const r = await sendWhatsAppImage({
          phoneNumberId: channel.meta_phone_number_id,
          accessToken: channel.access_token,
          toE164,
          imageUrl: photo.imageUrl,
          caption: photo.caption,
        });
        if (r.ok) sent.push(photo.productId);
      }
      await recordShownProductIds(admin, conversationId, sent);
    }
  } catch (e) {
    console.warn("[ai/auto-reply] product photos failed", e);
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

  // Owner alert: a confirmed order is worth a ping to the shop owner's own
  // WhatsApp. Best-effort; never blocks or fails the customer reply.
  if (actionDecision && actionDecision.kind === "order_proposal") {
    const p = actionDecision.proposal as Record<string, unknown>;
    if (p.action === "confirm_order" && typeof p.order_id === "string") {
      try {
        await notifyOwnerOrderConfirmed(admin, p.order_id);
      } catch (e) {
        console.error("[ai/auto-reply] owner confirm alert threw", e);
      }
    }
  }
}
