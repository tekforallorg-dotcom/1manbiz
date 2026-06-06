import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";
import {
  draftReply,
  REPLY_MODEL,
  type ReplyCatalogProduct,
  type ReplyDeliveryZone,
  type ReplyKnowledgeItem,
  type ReplyLine,
} from "@/lib/ai/draft-reply";

/**
 * AI customer-reply draft endpoint (AI-native brick 2). Read-only: returns a
 * drafted reply, SENDS NOTHING. The vendor (or, later, the autonomous loop)
 * decides whether to send it.
 *
 * Auth mirrors /api/ai/parse-order (cookie for web, Bearer for mobile).
 * Prices are formatted server-side from kobo, so the model only ever relays
 * server-truth money, never computes it. Each draft is logged to ai_decisions
 * (kind 'reply', outcome 'pending') for the semi-autonomous evidence base.
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
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[ai/draft-reply] ANTHROPIC_API_KEY not set");
    return NextResponse.json({ ok: false, error: "AI not configured" }, { status: 500 });
  }

  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let payload: { conversationId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "conversationId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id, ai_tone, ai_language")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No business on file" }, { status: 403 });
  }

  const { data: convo, error: convoErr } = await admin
    .from("conversations")
    .select("id, business_id")
    .eq("id", conversationId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (convoErr) {
    console.error("[ai/draft-reply] convo lookup failed", convoErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
  if (!convo) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const { data: msgRows, error: msgErr } = await admin
    .from("messages")
    .select("sender_role, body_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(40);
  if (msgErr) {
    console.error("[ai/draft-reply] messages load failed", msgErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }

  const { data: prodRows, error: prodErr } = await admin
    .from("products")
    .select("name, price_kobo, stock_quantity")
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);
  if (prodErr) {
    console.error("[ai/draft-reply] products load failed", prodErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }

  const { data: zoneRows } = await admin
    .from("delivery_zones")
    .select("label, fee_kobo, note")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const { data: knowledgeRows } = await admin
    .from("knowledge_items")
    .select("title, content")
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  const messages: ReplyLine[] = [...(msgRows ?? [])].reverse().map((m) => ({
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

  const result = await draftReply({ apiKey, messages, catalog, deliveryZones, knowledgeItems, tone, language });
  if (!result.ok) {
    console.error("[ai/draft-reply] draft failed", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  let decisionId: string | null = null;
  try {
    const { data: decision, error: logErr } = await admin
      .from("ai_decisions")
      .insert({
        business_id: business.id,
        conversation_id: conversationId,
        created_by: userId,
        kind: "reply",
        mode: "assisted",
        model: REPLY_MODEL,
        input_message_count: messages.length,
        item_count: 0,
        confidence: result.confidence,
        proposal: { reply: result.reply, confidence: result.confidence },
      })
      .select("id")
      .single();
    if (logErr) {
      console.error("[ai/draft-reply] decision log failed", logErr);
    } else {
      decisionId = decision?.id ?? null;
    }
  } catch (e) {
    console.error("[ai/draft-reply] decision log threw", e);
  }

  return NextResponse.json({
    ok: true,
    reply: result.reply,
    confidence: result.confidence,
    decisionId,
  });
}
