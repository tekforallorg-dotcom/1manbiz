/**
 * AI order-draft parsing (3H.1).
 *
 * Reads a customer's chat messages plus the shop's active catalog and asks an
 * Anthropic model to map the conversation to catalog product ids + quantities.
 *
 * SAFETY: the model proposes product ids and quantities ONLY. Name and price
 * are always resolved server-side from the catalog the caller passed in; any
 * id the model invents is discarded. The model never sets money. This module
 * performs no DB access and creates nothing — it returns a proposal object.
 */

export const ORDER_PARSE_MODEL = "claude-haiku-4-5-20251001";

export interface CatalogProduct {
  id: string;
  name: string;
  price_kobo: number;
  stock_quantity: number;
}

export interface InboundLine {
  sender_role: "customer" | "vendor" | "ai";
  body_text: string;
}

// Proposal shape is the cross-app contract; defined once in @1manbiz/shared.
// Re-exported here so existing importers of "@/lib/ai/parse-order" keep working.
import type { ProposalLineItem, CustomerHint, OrderProposal } from "@1manbiz/shared";
export type { ProposalLineItem, CustomerHint, OrderProposal };

export type ParseResult =
  | { ok: true; proposal: OrderProposal }
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
  // Strip a ```json ... ``` fence if the model added one.
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function resolveProposal(parsed: unknown, catalog: CatalogProduct[]): ParseResult {
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "AI returned invalid structure" };
  }
  const obj = parsed as Record<string, unknown>;
  const byId = new Map<string, CatalogProduct>(catalog.map((p) => [p.id, p]));

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const lineItems: ProposalLineItem[] = [];
  for (const it of rawItems) {
    if (typeof it !== "object" || it === null) continue;
    const r = it as Record<string, unknown>;
    const pid = typeof r.productId === "string" ? r.productId : "";
    const prod = byId.get(pid);
    if (!prod) continue; // discard hallucinated / unknown ids
    let qty = typeof r.qty === "number" ? Math.floor(r.qty) : 1;
    if (!Number.isFinite(qty) || qty < 1) qty = 1;
    if (qty > 999) qty = 999;
    lineItems.push({
      productId: prod.id,
      name: prod.name,
      qty,
      unitPriceKobo: prod.price_kobo,
      stockQty: prod.stock_quantity,
    });
  }

  let customerHint: CustomerHint | null = null;
  if (typeof obj.customer === "object" && obj.customer !== null) {
    const c = obj.customer as Record<string, unknown>;
    const name = typeof c.name === "string" && c.name.trim() ? c.name.trim() : null;
    const phone = typeof c.phone === "string" && c.phone.trim() ? c.phone.trim() : null;
    if (name || phone) customerHint = { name, phone };
  }

  const notes = typeof obj.notes === "string" ? obj.notes.slice(0, 280) : "";
  const confidence = obj.confidence === "high" ? "high" : "low";

  return { ok: true, proposal: { lineItems, customerHint, notes, confidence } };
}

export async function parseOrderFromMessages(args: {
  apiKey: string;
  messages: InboundLine[];
  catalog: CatalogProduct[];
}): Promise<ParseResult> {
  const { apiKey, messages, catalog } = args;

  // Build a role-labelled transcript of the customer/shop exchange. Order intent
  // comes from the customer, but the shop (vendor) often restates or confirms it
  // ("so that's 2 X and 1 Y, deliver to Z") - the cleanest statement of the order
  // frequently lives in a vendor line, so we feed both sides as context. Prior
  // 'ai' drafts are excluded to avoid a self-reinforcing feedback loop.
  const convoLines: string[] = [];
  for (const m of messages) {
    if (m.sender_role !== "customer" && m.sender_role !== "vendor") continue;
    const t = (m.body_text ?? "").trim();
    if (!t) continue;
    const who = m.sender_role === "customer" ? "Customer" : "Shop";
    convoLines.push(`${who}: ${t}`);
  }

  if (convoLines.length === 0) {
    return { ok: false, error: "No messages to read yet" };
  }
  if (catalog.length === 0) {
    return { ok: false, error: "No active products to match against" };
  }

  const catalogLines = catalog.map((p) => `- ${p.id} | ${p.name}`).join("\n");
  const recent = convoLines.slice(-20).join("\n");

  const system =
    "You convert a chat between a customer and a shop into a draft order for that shop. " +
    "You are given the shop's product catalog (id and name only) and the recent conversation, " +
    "where each line is labelled 'Customer:' or 'Shop:'. " +
    "Extract what the CUSTOMER is buying. Shop lines are context: they may confirm, clarify, or " +
    "restate the order, so use them to settle items and quantities, but never invent an order the " +
    "customer did not actually request. " +
    "Map only to catalog product ids. Never invent products or ids. Never output prices. " +
    "If a quantity is unclear, use 1. If neither side indicates a real order, return an empty items array. " +
    "Respond with ONLY a single JSON object, no markdown fences, no prose.";

  const user =
    `CATALOG (id | name):\n${catalogLines}\n\n` +
    `CONVERSATION (oldest to newest):\n${recent}\n\n` +
    `Return JSON exactly in this shape: ` +
    `{"items":[{"productId":"<catalog id>","qty":<integer>}],` +
    `"customer":{"name":<string or null>,"phone":<string or null>},` +
    `"notes":"<one short sentence>","confidence":"high"|"low"}`;

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
        model: ORDER_PARSE_MODEL,
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    console.error("[ai/parse-order] fetch failed", e);
    return { ok: false, error: "AI service unreachable" };
  }

  if (!res.ok) {
    console.error("[ai/parse-order] anthropic non-200", res.status);
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
  if (parsed === null) return { ok: false, error: "AI returned invalid JSON" };

  return resolveProposal(parsed, catalog);
}
