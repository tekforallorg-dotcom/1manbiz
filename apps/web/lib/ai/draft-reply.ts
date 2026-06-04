/**
 * AI customer-reply drafting (AI-native brick 2).
 *
 * Reads the recent customer/shop conversation plus the shop's active catalog
 * and drafts a single WhatsApp reply to the customer's latest message.
 *
 * GROUNDING + SAFETY:
 *  - The model may quote product names, prices, and availability ONLY from the
 *    catalog passed in. Prices are pre-formatted server-side (server truth); the
 *    model relays them, it never computes or invents money.
 *  - If the customer asks something the catalog can't answer (delivery, address,
 *    bespoke requests), the model must NOT make facts up: it returns a brief
 *    holding reply and sets confidence "low" so a human reviews before send.
 *  - This module performs no DB access and sends nothing. It returns a draft.
 */

export const REPLY_MODEL = "claude-haiku-4-5-20251001";

export interface ReplyCatalogProduct {
  name: string;
  price_naira: string; // pre-formatted server-side, e.g. "N2,100,000"
  in_stock: boolean;
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
  tone: string;
  language: string;
}): Promise<DraftReplyResult> {
  const { apiKey, messages, catalog, tone, language } = args;

  const convoLines: string[] = [];
  for (const m of messages) {
    if (m.sender_role !== "customer" && m.sender_role !== "vendor") continue;
    const t = (m.body_text ?? "").trim();
    if (!t) continue;
    const who = m.sender_role === "customer" ? "Customer" : "Shop";
    convoLines.push(`${who}: ${t}`);
  }
  if (convoLines.length === 0) {
    return { ok: false, error: "No customer messages to reply to yet" };
  }

  const catalogLines =
    catalog.length > 0
      ? catalog
          .map((p) => `- ${p.name} | ${p.price_naira} | ${p.in_stock ? "in stock" : "out of stock"}`)
          .join("\n")
      : "(no active products)";
  const recent = convoLines.slice(-20).join("\n");

  const system =
    "You are the WhatsApp assistant for a small shop, replying to the customer's latest message. " +
    "You are given the shop's product catalog (name, price, availability) and the recent conversation, " +
    "each line labelled 'Customer:' or 'Shop:'. " +
    "Answer questions about products, prices, and availability using ONLY the catalog facts given. " +
    "Quote prices and product names exactly as written in the catalog. Never invent products, prices, or stock. " +
    "If the customer asks something the catalog cannot answer (delivery, location, payment, bespoke requests), " +
    "do NOT make up an answer: give a short, polite holding reply (e.g. that the shop owner will confirm shortly) " +
    "and set confidence to \"low\". Set confidence \"high\" only when your reply is fully grounded in the catalog. " +
    "Keep the reply short and natural for WhatsApp. No markdown, no preamble. " +
    "Write the reply in the language code: " + language + ". Use a " + tone + " tone. " +
    "Respond with ONLY a single JSON object, no markdown fences, no prose.";

  const user =
    `CATALOG (name | price | availability):\n${catalogLines}\n\n` +
    `CONVERSATION (oldest to newest):\n${recent}\n\n` +
    `Return JSON exactly in this shape: {"reply":"<your reply text>","confidence":"high"|"low"}`;

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
  const confidence = obj.confidence === "high" ? "high" : "low";

  return { ok: true, reply, confidence };
}
