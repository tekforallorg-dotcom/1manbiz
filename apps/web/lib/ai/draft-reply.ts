/**
 * AI customer-reply drafting (corrected).
 *
 * v2 overengineering regression: a 25-rule prompt overwhelmed Haiku 4.5 and
 * the model returned generic "Hi! What can I help you with?" replies plus
 * silently dropped needs_human from the JSON, defaulting everything to
 * high-confidence auto-send. This rewrites with v1's focused 5-rule structure
 * plus the ONE anti-bleed rule that was actually needed.
 *
 * Caller contract preserved: returns { reply, confidence: "high" | "low" }.
 * Routes and auto-reply.ts are unchanged.
 */

export const REPLY_MODEL = "claude-haiku-4-5-20251001";

export interface ReplyCatalogProduct {
  name: string;
  price_naira: string;
  in_stock: boolean;
}

export interface ReplyDeliveryZone {
  label: string;
  fee_naira: string;
  note?: string | null;
}

export interface ReplyLine {
  sender_role: "customer" | "vendor" | "ai";
  body_text: string;
}

export type DraftReplyResult =
  | { ok: true; reply: string; confidence: "high" | "low" }
  | { ok: false; error: string };

function extractText(data: unknown): string {
  if (typeof data !== "object" || data === null) return "";
  const content = (data as Record<string, unknown>).content;
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const block of content) {
    if (typeof block === "object" && block !== null) {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") out += b.text;
    }
  }
  return out.trim();
}

function safeJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export async function draftReply(args: {
  apiKey: string;
  messages: ReplyLine[];
  catalog: ReplyCatalogProduct[];
  deliveryZones?: ReplyDeliveryZone[];
  tone: string;
  language: string;
}): Promise<DraftReplyResult> {
  const { apiKey, messages, catalog, tone, language } = args;
  const deliveryZones = args.deliveryZones ?? [];

  // Include vendor AND ai messages as "Shop:" so the model sees its own past
  // replies and won't restate them. v1 dropped ai entirely; v2 included them.
  // Keeping v2's inclusion (it's correct), reverting v2's prompt (it wasn't).
  const lines: string[] = [];
  let latest = "";
  for (const m of messages) {
    const text = (m.body_text ?? "").trim();
    if (!text) continue;
    if (m.sender_role === "customer") {
      lines.push("Customer: " + text);
      latest = text;
    } else if (m.sender_role === "vendor" || m.sender_role === "ai") {
      lines.push("Shop: " + text);
    }
  }
  if (!latest) {
    return { ok: false, error: "No customer message to reply to yet" };
  }

  const recent = lines.slice(-20).join("\n");

  const catalogBlock =
    catalog.length > 0
      ? catalog
          .map((p) => "- " + p.name + " | " + p.price_naira + " | " + (p.in_stock ? "in stock" : "out of stock"))
          .join("\n")
      : "(no active products)";

  const deliveryBlock =
    deliveryZones.length > 0
      ? deliveryZones
          .map((z) => "- " + z.label + ": " + z.fee_naira + (z.note ? " (" + z.note + ")" : ""))
          .join("\n")
      : "(no delivery zones configured)";

  // 5 focused rules. No sub-checklist. Haiku follows this reliably.
  const system =
    "You are the WhatsApp assistant for a small shop, replying to the customer's most recent message. " +
    "You have the shop's product CATALOG, DELIVERY zones, and the recent CONVERSATION (each line labelled 'Customer:' or 'Shop:'; 'Shop:' includes both the vendor and your own earlier replies).\n\n" +
    "RULE 1 — ANSWER ONLY THE LATEST CUSTOMER MESSAGE. Do not volunteer unrelated info. If they ask about a product, do not mention delivery. If they ask about delivery, do not list products. Stay on the question.\n\n" +
    "RULE 2 — USE ONLY THE CATALOG AND DELIVERY BLOCKS for facts. Quote names, prices, stock status, and delivery fees EXACTLY as written. Never invent or estimate.\n\n" +
    "RULE 3 — DO NOT REPEAT what 'Shop:' has already said in this conversation. If the customer is asking again, give more detail or ask a clarifying question — never restate the same greeting twice.\n\n" +
    "RULE 4 — IF YOU DON'T HAVE THE FACTS (refunds, returns, warranty, hours, location, payment methods, unlisted delivery area, complaints, haggling, custom requests), do NOT make up an answer. Give a short polite holding reply (e.g. 'Let me check with the shop on that and get back to you shortly') and set confidence to 'low'.\n\n" +
    "RULE 5 — FOR ORDER INTENT ('I want X', 'I'll take 2'), confirm verbally — item, quantity, line total from catalog prices — and ask for delivery area / name if missing. Do NOT pretend the order is placed. The shop owner will send the payment link.\n\n" +
    "Set confidence 'high' ONLY when your reply is fully grounded in CATALOG or DELIVERY. Otherwise 'low'.\n\n" +
    "Tone: warm, brief, human — like a real shop attendant on WhatsApp. No 'Thank you for your inquiry'. No emojis unless the customer used one. " +
    "Language: '" + language + "'. Style: '" + tone + "'.\n\n" +
    "Respond with ONLY this JSON, no markdown fences, no prose:\n" +
    '{"reply":"<message to send>","confidence":"high"|"low"}';

  const user =
    "CATALOG (name | price | availability):\n" +
    catalogBlock +
    "\n\nDELIVERY (area: fee (note)):\n" +
    deliveryBlock +
    "\n\nCONVERSATION (oldest to newest):\n" +
    recent +
    "\n\nReply to the final 'Customer:' line above. Return ONLY the JSON.";

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: REPLY_MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    console.error("[ai/draft-reply] fetch failed", e);
    return { ok: false, error: "AI service unreachable" };
  }

  if (!res.ok) {
    console.error("[ai/draft-reply] anthropic non-200", res.status);
    return { ok: false, error: "AI service error" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "AI returned malformed response" };
  }

  const text = extractText(data);
  if (!text) return { ok: false, error: "AI returned empty response" };

  const parsed = safeJson(text);
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "AI returned invalid JSON" };
  }
  const obj = parsed as Record<string, unknown>;
  const reply = typeof obj.reply === "string" ? obj.reply.trim() : "";
  if (!reply) return { ok: false, error: "AI returned an empty reply" };

  // SAFE DEFAULT: confidence falls back to "low" if missing or anything other
  // than the literal "high". v2's bug was defaulting to high on missing — that
  // turns every uncertain reply into an auto-send. "low" suppresses → human.
  const confidence: "high" | "low" = obj.confidence === "high" ? "high" : "low";

  return { ok: true, reply, confidence };
}
