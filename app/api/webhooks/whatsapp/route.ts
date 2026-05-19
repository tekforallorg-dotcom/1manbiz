import { NextRequest, NextResponse } from "next/server";

/**
 * WhatsApp webhook endpoint.
 *
 *   GET  -> Meta verification challenge (compare hub.verify_token against
 *           the WHATSAPP_WEBHOOK_VERIFY_TOKEN env var, echo hub.challenge).
 *   POST -> Receive a webhook event. For slice 3G.A we just log the payload
 *           and return 200 immediately (Meta requires fast ack). Parsing
 *           into conversations + messages tables ships in 3G.B.
 *
 * Signature validation (HMAC-SHA256 of body using WHATSAPP_APP_SECRET) is
 * implemented but currently warns-only — set to enforce in 3G.B once we
 * have logs to debug any mismatch.
 */

export const dynamic = "force-dynamic";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

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

async function verifySignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!APP_SECRET) {
    console.warn("[whatsapp-webhook] WHATSAPP_APP_SECRET not set; skipping signature check");
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
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(rawBody));
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hex === expected;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  const valid = await verifySignature(rawBody, signatureHeader);
  if (!valid) {
    console.warn("[whatsapp-webhook] signature mismatch (allowing in 3G.A; will enforce in 3G.B)");
  }

  try {
    const payload = JSON.parse(rawBody);
    console.log("[whatsapp-webhook] payload", JSON.stringify(payload).slice(0, 2000));
  } catch {
    console.warn("[whatsapp-webhook] non-JSON body", rawBody.slice(0, 500));
  }

  return NextResponse.json({ ok: true });
}
