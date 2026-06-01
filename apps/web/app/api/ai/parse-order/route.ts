import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import {
  parseOrderFromMessages,
  type CatalogProduct,
  type InboundLine,
} from "@/lib/ai/parse-order";

/**
 * AI order-draft endpoint (3H.1). Read-only: returns a proposal, writes nothing.
 *
 * Auth mirrors /api/messages/send exactly (cookie for web, Bearer for mobile).
 * Ownership is verified in code, then the admin client loads the conversation's
 * messages and the business's active catalog. The model only sees product
 * id + name; prices are never sent to or taken from the model.
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
    console.error("[ai/parse-order] ANTHROPIC_API_KEY not set");
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
    .select("id")
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
    console.error("[ai/parse-order] convo lookup failed", convoErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }
  if (!convo) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const { data: msgRows, error: msgErr } = await admin
    .from("messages")
    .select("sender_role, body_text, sent_at")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: true })
    .limit(40);
  if (msgErr) {
    console.error("[ai/parse-order] messages load failed", msgErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }

  const { data: prodRows, error: prodErr } = await admin
    .from("products")
    .select("id, name, price_kobo, stock_quantity")
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);
  if (prodErr) {
    console.error("[ai/parse-order] products load failed", prodErr);
    return NextResponse.json({ ok: false, error: "Lookup failed" }, { status: 500 });
  }

  const messages: InboundLine[] = (msgRows ?? []).map((m) => ({
    sender_role: m.sender_role as InboundLine["sender_role"],
    body_text: (m.body_text as string | null) ?? "",
  }));
  const catalog: CatalogProduct[] = (prodRows ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    price_kobo: Number(p.price_kobo),
    stock_quantity: Number(p.stock_quantity),
  }));

  console.log("[ai/parse-order] start", {
    conversationId,
    messages: messages.length,
    products: catalog.length,
  });

  const result = await parseOrderFromMessages({ apiKey, messages, catalog });

  if (!result.ok) {
    console.error("[ai/parse-order] parse failed", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  console.log("[ai/parse-order] success", {
    conversationId,
    items: result.proposal.lineItems.length,
    confidence: result.proposal.confidence,
  });
  return NextResponse.json({ ok: true, proposal: result.proposal });
}
