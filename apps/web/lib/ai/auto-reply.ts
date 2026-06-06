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

/**
 * Autonomous reply loop (AI-native brick 3). Called from the WhatsApp webhook
 * after a FRESH inbound customer message is persisted. Never throws -- any
 * failure is logged and swallowed so the webhook always returns 200 to Meta.
 *
 * Guardrails:
 *  - Only acts when ai_mode = 'autonomous' (off/assisted/semi never auto-send).
 *  - Only sends when the reply is high-confidence and grounded in the catalog;
 *    low-confidence degrades to "leave for the vendor" (logged, not sent).
 *  - Answers questions only: it NEVER creates orders, marks paid, or sends
 *    payment links. Money actions stay human.
 *  - The reply is stored as sender_role 'ai' (visually distinct; also excluded
 *    from future parse/draft input, so the AI never feeds on its own output).
 *  - Idempotency is the caller's responsibility: the webhook only invokes this
 *    on a fresh message insert, so webhook retries do not double-reply.
 */
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
    .select("id, ai_mode, ai_tone, ai_language")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return;
  const mode = (business.ai_mode as AiMode | null) ?? "assisted";
  if (mode !== "autonomous") return;

  // Channel must be connected with usable per-tenant credentials.
  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", channelAccountId)
    .maybeSingle();
  if (!channel || channel.status !== "connected") return;
  if (!channel.meta_phone_number_id || !channel.access_token) return;

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
  const result = await draftReply({ apiKey, messages, catalog, deliveryZones, knowledgeItems, tone, language });
  void broadcastTyping(conversationId, "stop");
  if (!result.ok) {
    console.error("[ai/auto-reply] draft failed", result.error);
    return;
  }

  // The trigger is a customer inbound that just arrived, so the 24h window is
  // open by construction.
  const act = shouldAutoSend({ mode, windowOpen: true, confidence: result.confidence });

  const logDecision = async (outcome: "auto_sent" | "pending") => {
    try {
      await admin.from("ai_decisions").insert({
        business_id: businessId,
        conversation_id: conversationId,
        kind: "reply",
        mode: "autonomous",
        model: REPLY_MODEL,
        input_message_count: messages.length,
        item_count: 0,
        confidence: result.confidence,
        proposal: { reply: result.reply, confidence: result.confidence },
        outcome,
        outcome_at: outcome === "auto_sent" ? new Date().toISOString() : null,
      });
    } catch (e) {
      console.error("[ai/auto-reply] decision log threw", e);
    }
  };

  if (!act) {
    // Low confidence: do not send. The unread customer message stays in the
    // inbox for the vendor; we log the suppressed draft for the evidence base.
    await logDecision("pending");
    return;
  }

  const sendResult = await sendWhatsAppText({
    phoneNumberId: channel.meta_phone_number_id,
    accessToken: channel.access_token,
    toE164,
    body: result.reply,
  });
  if (!sendResult.ok) {
    console.error("[ai/auto-reply] send failed", sendResult.error);
    await logDecision("pending");
    return;
  }

  const sentAt = new Date().toISOString();
  const preview = result.reply.slice(0, 80);

  await admin.from("messages").insert({
    conversation_id: conversationId,
    direction: "out",
    sender_role: "ai",
    body_text: result.reply,
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

  await logDecision("auto_sent");
}
