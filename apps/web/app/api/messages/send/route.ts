import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { sendWhatsAppText } from "@/lib/whatsapp/send";

/**
 * Outbound message endpoint.
 *
 * Auth: dual-mode.
 *   - Cookie session (web)         -> @supabase/ssr server client
 *   - Authorization: Bearer <jwt>  -> admin client + auth.getUser(token)
 *
 * Flow:
 *   1. Authenticate (resolve user_id).
 *   2. Resolve user_id -> business_id.
 *   3. Load conversation, scoped to business_id (404 on cross-tenant id).
 *   4. Load channel_account credentials.
 *   5. POST to Meta Graph API.
 *   6. On success: insert message row + update conversation.
 *
 * All DB writes use the admin client (RLS bypass) AFTER ownership is verified
 * in code. We never trust client-supplied conversation ids without scoping.
 */

export const dynamic = "force-dynamic";

const MAX_BODY_CHARS = 4096; // Meta\u0027s freeform text limit.

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
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: { conversationId?: string; body?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
  const trimmedBody = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }
  if (!trimmedBody) {
    return NextResponse.json({ error: "Message body cannot be empty" }, { status: 400 });
  }
  if (trimmedBody.length > MAX_BODY_CHARS) {
    return NextResponse.json(
      { error: "Message too long (max " + MAX_BODY_CHARS + " chars)" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ error: "No business on file" }, { status: 403 });
  }

  const { data: convo, error: convoErr } = await admin
    .from("conversations")
    .select("id, business_id, channel_account_id, contact_phone_e164")
    .eq("id", conversationId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (convoErr) {
    console.error("[messages/send] convo lookup failed", convoErr);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (!convo.channel_account_id) {
    return NextResponse.json(
      { error: "Conversation has no linked channel account" },
      { status: 400 },
    );
  }
  if (!convo.contact_phone_e164) {
    return NextResponse.json(
      { error: "No customer phone on file" },
      { status: 400 },
    );
  }

  const { data: channel } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token, status")
    .eq("id", convo.channel_account_id)
    .maybeSingle();
  if (!channel || channel.status !== "connected") {
    return NextResponse.json(
      { error: "WhatsApp channel not connected" },
      { status: 400 },
    );
  }
  if (!channel.meta_phone_number_id || !channel.access_token) {
    return NextResponse.json(
      { error: "Channel credentials missing" },
      { status: 400 },
    );
  }

  const sendResult = await sendWhatsAppText({
    phoneNumberId: channel.meta_phone_number_id,
    accessToken: channel.access_token,
    toE164: convo.contact_phone_e164,
    body: trimmedBody,
  });

  if (!sendResult.ok) {
    return NextResponse.json(
      { error: sendResult.error },
      { status: sendResult.status === 401 || sendResult.status === 403 ? 502 : 502 },
    );
  }

  const sentAt = new Date().toISOString();
  const preview = trimmedBody.slice(0, 80);

  const { data: insertedRow, error: insertErr } = await admin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      direction: "out",
      sender_role: "vendor",
      body_text: trimmedBody,
      sent_at: sentAt,
      meta_message_id: sendResult.wamid,
      meta_status: "sent",
    })
    .select("id, direction, sender_role, body_text, media_url, media_type, sent_at, meta_status")
    .single();

  if (insertErr || !insertedRow) {
    console.error("[messages/send] insert failed after Meta success", insertErr);
    // Message was delivered on WhatsApp but local copy failed. Be honest.
    return NextResponse.json({
      ok: true,
      warning: "Message sent on WhatsApp but local copy failed to save",
      wamid: sendResult.wamid,
    });
  }

  await admin
    .from("conversations")
    .update({
      last_message_at: sentAt,
      last_message_preview: preview,
      last_message_direction: "out",
    })
    .eq("id", conversationId);

  return NextResponse.json({ ok: true, message: insertedRow });
}
