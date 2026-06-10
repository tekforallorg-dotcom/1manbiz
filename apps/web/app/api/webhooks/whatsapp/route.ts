import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { previewFromIncoming } from "@/lib/conversations";
import { normalizePhoneE164 } from "@/lib/phone";
import { maybeAutoReply } from "@/lib/ai/auto-reply";
import {
  handleOwnerLink,
  handleOwnerLinkExpired,
  handleOwnerMessage,
} from "@/lib/ai/owner/route-owner";

/**
 * WhatsApp Cloud API webhook.
 *
 *   GET  -> Meta verification challenge.
 *   POST -> Receive webhook events. Parses entry[].changes[].value:
 *           - messages[]: inbound customer messages -> upsert customer +
 *             conversation, insert message row, bump unread.
 *           - statuses[]: delivery/read receipts -> update message status.
 *
 * Signature validation: HMAC-SHA256 of raw body using WHATSAPP_APP_SECRET.
 *   - Enforced when APP_SECRET is set.
 *   - Skipped (with warning) when not set, for local dev / ngrok.
 *
 * All DB writes use the service-role client to bypass RLS, since the caller
 * is Meta, not an authenticated user.
 */

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

// --------------------------------------------------------------------------
// GET verification
// --------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!VERIFY_TOKEN) {
    console.error("[whatsapp-webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not set");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    console.log("[whatsapp-webhook] verify OK");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[whatsapp-webhook] verify rejected", { mode, tokenMatch: token === VERIFY_TOKEN });
  return new NextResponse("Forbidden", { status: 403 });
}

// --------------------------------------------------------------------------
// Signature
// --------------------------------------------------------------------------
async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!APP_SECRET) {
    // Dev mode (no secret configured) — allow but warn.
    return true;
  }
  if (!signatureHeader) return false;
  const expected = signatureHeader.startsWith("sha256=") ? signatureHeader.slice(7) : signatureHeader;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === expected;
}

// --------------------------------------------------------------------------
// Types (loose — Meta payload is wide and we only read a subset)
// --------------------------------------------------------------------------
interface WhatsAppPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          image?: { id?: string; caption?: string; mime_type?: string };
          video?: { id?: string; caption?: string };
          audio?: { id?: string };
          document?: { id?: string; filename?: string };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
        }>;
      };
    }>;
  }>;
}

// --------------------------------------------------------------------------
// POST handler
// --------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  const valid = await verifySignature(rawBody, signatureHeader);
  if (!valid) {
    console.warn("[whatsapp-webhook] signature mismatch — rejecting");
    return new NextResponse("Forbidden", { status: 401 });
  }
  if (!APP_SECRET) {
    console.warn("[whatsapp-webhook] WHATSAPP_APP_SECRET not set — signature check skipped");
  }

  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn("[whatsapp-webhook] non-JSON body", rawBody.slice(0, 200));
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) {
        console.warn("[whatsapp-webhook] change without phone_number_id, skipping");
        continue;
      }

      // Resolve channel_account -> business_id.
      const { data: channelAccount, error: channelErr } = await admin
        .from("channel_accounts")
        .select("id, business_id")
        .eq("meta_phone_number_id", phoneNumberId)
        .maybeSingle();

      if (channelErr) {
        console.error("[whatsapp-webhook] channel lookup failed", channelErr);
        continue;
      }
      if (!channelAccount) {
        console.warn("[whatsapp-webhook] no channel_account for phone_number_id", phoneNumberId);
        continue;
      }

      const businessId: string = channelAccount.business_id;
      const channelAccountId: string = channelAccount.id;

      // Owner-mode routing data: who owns this shop and the active link code.
      const { data: bizRow } = await admin
        .from("businesses")
        .select("name, owner_phone, owner_link_code, owner_link_code_expires_at")
        .eq("id", businessId)
        .maybeSingle();
      const biz = (bizRow ?? null) as {
        name?: string | null;
        owner_phone?: string | null;
        owner_link_code?: string | null;
        owner_link_code_expires_at?: string | null;
      } | null;

      // Conversations that received a FRESH customer text in this delivery.
      // We auto-reply once per conversation after the message loop (batch-safe),
      // and only on fresh inserts so webhook retries never double-reply.
      const autoReplyTargets = new Map<string, string>(); // conversationId -> toE164

      // ----- Inbound messages -----
      const contactsByWaId = new Map<string, { name?: string }>();
      for (const c of value.contacts ?? []) {
        if (c.wa_id) contactsByWaId.set(c.wa_id, { name: c.profile?.name });
      }

      for (const message of value.messages ?? []) {
        const waId = message.from;
        if (!waId || !message.id) continue;

        // wa_id from Meta is digits-only E.164 (no leading +). Run through the
        // shared normaliser so this stays robust to any malformed inputs.
        const phoneE164 = normalizePhoneE164(waId, "NG");
        if (!phoneE164) {
          console.warn("[whatsapp-webhook] could not normalise wa_id, skipping", waId);
          continue;
        }
        const contactName = contactsByWaId.get(waId)?.name ?? null;

        // ----- Owner mode -----
        // LINK <code> claims ownership from the owner's personal phone
        // (possession of the device is the handshake). Once linked, every
        // message from owner_phone routes to the management brain and never
        // touches the customer CRM. UNLINK (handled inside) detaches.
        const inboundText = message.type === "text" ? (message.text?.body ?? "").trim() : "";
        const linkMatch = inboundText.match(/^link\s+([a-z0-9-]{4,24})$/i);
        if (linkMatch && biz?.owner_link_code) {
          const codeMatches =
            (linkMatch[1] ?? "").toUpperCase() === biz.owner_link_code.toUpperCase();
          const notExpired =
            !biz.owner_link_code_expires_at ||
            new Date(biz.owner_link_code_expires_at).getTime() > Date.now();
          if (codeMatches && notExpired) {
            await handleOwnerLink(admin, { businessId, phoneE164, channelAccountId });
            continue;
          }
          if (codeMatches && !notExpired) {
            // Right code, but it has expired: tell them, do not link, do not
            // fall through to the customer bot.
            await handleOwnerLinkExpired(admin, { businessId, phoneE164, channelAccountId });
            continue;
          }
        }
        if (biz?.owner_phone && biz.owner_phone === phoneE164) {
          const ownerImageId = message.type === "image" ? (message.image?.id ?? null) : null;
          const ownerText =
            message.type === "text"
              ? inboundText
              : (message.image?.caption ?? message.video?.caption ?? "").trim();
          await handleOwnerMessage(admin, {
            businessId,
            businessName: biz?.name ?? "your shop",
            phoneE164,
            text: ownerText,
            channelAccountId,
            imageMediaId: ownerImageId,
          });
          continue;
        }

        // 1) Find or create customer for this business + phone.
        const { data: existingCustomer, error: custLookupErr } = await admin
          .from("customers")
          .select("id, name")
          .eq("business_id", businessId)
          .eq("phone_e164", phoneE164)
          .maybeSingle();

        if (custLookupErr) {
          console.error("[whatsapp-webhook] customer lookup failed", custLookupErr);
          continue;
        }

        let customerId: string;
        if (existingCustomer) {
          customerId = existingCustomer.id;
          // Backfill name from WA profile if customer record has none.
          if (!existingCustomer.name && contactName) {
            await admin
              .from("customers")
              .update({ name: contactName })
              .eq("id", customerId);
          }
        } else {
          const { data: newCustomer, error: custInsertErr } = await admin
            .from("customers")
            .insert({
              business_id: businessId,
              name: contactName,
              phone_e164: phoneE164,
            })
            .select("id")
            .single();
          if (custInsertErr || !newCustomer) {
            console.error("[whatsapp-webhook] customer insert failed", custInsertErr);
            continue;
          }
          customerId = newCustomer.id;
        }

        // 2) Upsert conversation (business_id, customer_id) unique.
        const preview = previewFromIncoming(message);
        const sentAt = message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        const { data: existingConvo, error: convoLookupErr } = await admin
          .from("conversations")
          .select("id, unread_count")
          .eq("business_id", businessId)
          .eq("customer_id", customerId)
          .maybeSingle();

        if (convoLookupErr) {
          console.error("[whatsapp-webhook] convo lookup failed", convoLookupErr);
          continue;
        }

        let conversationId: string;
        if (existingConvo) {
          conversationId = existingConvo.id;
          await admin
            .from("conversations")
            .update({
              last_message_at: sentAt,
              last_message_preview: preview,
              last_message_direction: "in",
              unread_count: (existingConvo.unread_count ?? 0) + 1,
              channel_account_id: channelAccountId,
            })
            .eq("id", conversationId);
        } else {
          const { data: newConvo, error: convoInsertErr } = await admin
            .from("conversations")
            .insert({
              business_id: businessId,
              channel: "whatsapp",
              channel_account_id: channelAccountId,
              customer_id: customerId,
              contact_phone_e164: phoneE164,
              last_message_at: sentAt,
              last_message_preview: preview,
              last_message_direction: "in",
              unread_count: 1,
              status: "open",
            })
            .select("id")
            .single();
          if (convoInsertErr || !newConvo) {
            console.error("[whatsapp-webhook] convo insert failed", convoInsertErr);
            continue;
          }
          conversationId = newConvo.id;
        }

        // 3) Insert message row (idempotent via meta_message_id UNIQUE).
        const bodyText = message.type === "text"
          ? (message.text?.body ?? null)
          : (message.image?.caption ?? message.video?.caption ?? null);

        const mediaType = ["image", "video", "audio", "document", "sticker"].includes(message.type ?? "")
          ? message.type ?? null
          : null;

        const { data: insertedMsg, error: msgInsertErr } = await admin
          .from("messages")
          .insert({
            conversation_id: conversationId,
            direction: "in",
            sender_role: "customer",
            body_text: bodyText,
            media_url: null, // Meta media requires a separate fetch with token; deferred.
            media_type: mediaType,
            sent_at: sentAt,
            meta_message_id: message.id,
          })
          .select("id")
          .maybeSingle();

        if (msgInsertErr) {
          // Duplicate wamid => idempotent replay; ignore. Other errors logged.
          if (!String(msgInsertErr.message).includes("duplicate key")) {
            console.error("[whatsapp-webhook] message insert failed", msgInsertErr);
          }
        } else if (insertedMsg && message.type === "text" && bodyText) {
          // Fresh inbound text -> eligible for an autonomous reply (one per
          // conversation; later messages in the same delivery just overwrite
          // the target, so we reply once with full context).
          autoReplyTargets.set(conversationId, phoneE164);
        }
      }

      // ----- Autonomous replies (brick 3) -----
      // Runs after all messages are persisted. maybeAutoReply self-gates on
      // ai_mode='autonomous' + high confidence, and never throws.
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      const origin = host ? proto + "://" + host : "https://1manbiz.vercel.app";
      for (const [convId, toE164] of autoReplyTargets) {
        try {
          await maybeAutoReply({
            businessId,
            conversationId: convId,
            channelAccountId,
            toE164,
            origin,
          });
        } catch (e) {
          console.error("[whatsapp-webhook] auto-reply threw", e);
        }
      }

      // ----- Status updates -----
      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue;
        await admin
          .from("messages")
          .update({ meta_status: status.status })
          .eq("meta_message_id", status.id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
