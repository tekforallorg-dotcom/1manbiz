/**
 * Owner-mode management brain.
 *
 * One Haiku call grounded in the owner context blocks. Reads are answered
 * straight from the blocks (numbers quoted exactly); stock and price changes
 * come back as a structured action that the server resolves, validates, and
 * proposes for a YES confirmation. The model never sets ids, never computes
 * money, and its reply is REPLACED by a server-composed proposal whenever an
 * action is emitted, so what the owner confirms is always what executes.
 */

export const OWNER_MODEL = "claude-haiku-4-5-20251001";

export interface OwnerChatTurn {
  direction: "in" | "out";
  body: string;
}

export type OwnerActionDraft =
  | { kind: "set_stock"; product: string; variant?: string; value: number }
  | { kind: "set_price"; product: string; variant?: string; value: number }
  | { kind: "add_product"; name: string; price: number; stock: number; imagePath?: string }
  | { kind: "set_product_active"; product: string; active: boolean }
  | { kind: "mark_order_paid"; order: string }
  | { kind: "cancel_order"; order: string }
  | { kind: "set_policy"; title: string; content: string };

export interface OwnerDraft {
  reply: string;
  action: OwnerActionDraft | null;
}

function extractText(data: unknown): string {
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
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Lenient, field-by-field parse of the model's action object into the typed
// union. Anything malformed becomes null (the reply still goes out; the
// server simply proposes nothing).
function parseAction(a: Record<string, unknown>): OwnerActionDraft | null {
  const kind = typeof a.kind === "string" ? a.kind : "";
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const n = (k: string) => (typeof a[k] === "number" ? Math.floor(a[k] as number) : NaN);

  if (kind === "set_stock" || kind === "set_price") {
    const product = s("product");
    const value = n("value");
    if (!product || !Number.isFinite(value)) return null;
    const variant = s("variant");
    return variant ? { kind, product, variant, value } : { kind, product, value };
  }
  if (kind === "add_product") {
    const name = s("name");
    const price = n("price");
    const stock = n("stock");
    if (!name || !Number.isFinite(price) || !Number.isFinite(stock)) return null;
    return { kind, name, price, stock };
  }
  if (kind === "set_product_active") {
    const product = s("product");
    if (!product || typeof a.active !== "boolean") return null;
    return { kind, product, active: a.active };
  }
  if (kind === "mark_order_paid" || kind === "cancel_order") {
    const order = s("order").replace(/^#/, "");
    if (!order) return null;
    return { kind, order };
  }
  if (kind === "set_policy") {
    const title = s("title");
    const content = s("content");
    if (!title || !content) return null;
    return { kind, title, content };
  }
  return null;
}

// Deterministic extraction of product fields from a free-text owner reply
// during the photo-add flow. No model round-trip: we read a price (with k/m
// suffixes and naira words), a stock count, and a fallback name. Kept simple
// and predictable; the owner confirms the final summary before anything saves.
export interface ProductFields {
  name: string | null;
  priceNaira: number | null;
  stock: number | null;
}

// Model-based extraction of product fields from a natural-language owner reply
// during the photo-add flow. People type prices and counts every which way
// ("2.8million", "2.8m", "N2,800,000", "10 piece", "i get 10", Pidgin, etc),
// which no regex handles well. We give Haiku the fields known so far plus the
// latest message and ask for ONLY the fields it can confidently read; anything
// unclear stays null. Bounds are still validated server-side and a YES is
// still required, so the model can never set money or save on its own. Falls
// back to the regex extractor if the call fails, so a hiccup never blocks the
// draft.
export async function extractProductFieldsAI(params: {
  apiKey: string;
  latest: string;
  known: { name: string | null; priceNaira: number | null; stock: number | null };
}): Promise<ProductFields> {
  const { apiKey, latest, known } = params;

  const system =
    "You help a shop owner add ONE new product by reading their WhatsApp message. " +
    "Pull out the product NAME, the PRICE in naira, and the STOCK count (how many they have). " +
    "The owner may write casually or in Nigerian English/Pidgin.\n" +
    "Rules:\n" +
    "- PRICE: return a plain integer of naira. Read shorthand: '2.8million' or '2.8m' = 2800000; " +
    "'650k' = 650000; 'N2,800,000' or '2800000 naira' = 2800000. Never include kobo.\n" +
    "- STOCK: a whole number of units. '10 piece', '10 pcs', 'i have 10', 'i get 10', '10 remain' all = 10.\n" +
    "- NAME: the product name only, cleaned of words like 'add', 'this', 'price', 'stock'. " +
    "Keep model/colour/size words that are part of the name (e.g. 'iPad Air M3 white').\n" +
    "- Only return a field if THIS message (or the known values) makes it clear. If a field is not " +
    "stated or you are unsure, return null for it. Never guess a price or a count.\n" +
    "- Do not invent a name. If the message is only a price or only a count, name is null.\n\n" +
    "Respond with ONLY this JSON, no prose, no fences:\n" +
    "{\"name\":<string or null>,\"price_naira\":<integer or null>,\"stock\":<integer or null>}";

  const knownLines =
    "Known so far: name=" + (known.name ?? "unknown") +
    ", price_naira=" + (known.priceNaira != null ? String(known.priceNaira) : "unknown") +
    ", stock=" + (known.stock != null ? String(known.stock) : "unknown") + ".";
  const user = knownLines + "\nOwner's latest message: " + latest;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: OWNER_MODEL,
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.warn("[owner/extract] non-200, falling back", res.status);
      return extractProductFieldsRegex(latest);
    }
    const data = (await res.json()) as unknown;
    const parsed = safeJson(extractText(data));
    if (!parsed || typeof parsed !== "object") return extractProductFieldsRegex(latest);
    const p = parsed as Record<string, unknown>;
    const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : null;
    const priceNaira =
      typeof p.price_naira === "number" && Number.isFinite(p.price_naira)
        ? Math.floor(p.price_naira)
        : null;
    const stock =
      typeof p.stock === "number" && Number.isFinite(p.stock) ? Math.floor(p.stock) : null;
    return { name, priceNaira, stock };
  } catch (e) {
    console.warn("[owner/extract] threw, falling back", e);
    return extractProductFieldsRegex(latest);
  }
}

// Deterministic fallback used only when the model call fails.
export function extractProductFieldsRegex(text: string): {
  name: string | null;
  priceNaira: number | null;
  stock: number | null;
} {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Price: "price 650000", "650k", "1.2m", "NGN 650,000", "650000 naira".
  let priceNaira: number | null = null;
  const priceLabelled = lower.match(/(?:price|cost|sell(?:s|ing)?(?:\s+for|\s+at)?|for|at|n|ngn|naira|#)\s*([0-9][0-9,\.]*)\s*([km])?/);
  const priceLoose = lower.match(/\b([0-9][0-9,\.]*)\s*([km])\b/);
  const pick = priceLabelled ?? priceLoose;
  if (pick) {
    const num = parseFloat((pick[1] ?? "").replace(/,/g, ""));
    const suffix = pick[2];
    if (Number.isFinite(num)) {
      priceNaira = suffix === "k" ? num * 1000 : suffix === "m" ? num * 1000000 : num;
    }
  }

  // Stock: "20 in stock", "stock 20", "qty 20", "x20", "20 units/pcs/pieces".
  let stock: number | null = null;
  const stockMatch =
    lower.match(/(?:stock|qty|quantity|have|got|x)\s*[:=]?\s*([0-9]{1,6})\b/) ??
    lower.match(/\b([0-9]{1,6})\s*(?:in\s*stock|units?|pcs|pieces|available)\b/);
  if (stockMatch) {
    const n = Number(stockMatch[1]);
    if (Number.isFinite(n)) stock = n;
  }

  // Name: an explicit "name X" / "call it X" / "named X", else a line that is
  // not obviously a number-only answer. Strip leading add verbs.
  let name: string | null = null;
  const nameLabelled = raw.match(/(?:name(?:d)?(?:\s+it)?|call(?:ed)?\s+it|its?\s+called)\s*[:\-]?\s*(.+)$/i);
  if (nameLabelled) {
    name = (nameLabelled[1] ?? "").trim();
  } else if (!/^[\s0-9,\.kmnNG#x:=]+$/i.test(raw)) {
    // Not a pure price/stock answer: treat the cleaned text as a candidate name.
    const cleaned = raw
      .replace(/\b(?:add|new|create|list|product|please|this|the|a|an|stock|price|cost|for|at|qty|quantity|units?|pcs|pieces|in)\b/gi, " ")
      .replace(/\b[0-9][0-9,\.]*\s*[km]?\b/gi, " ")
      .replace(/[#:=]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 80) name = cleaned;
  }

  return { name: name || null, priceNaira, stock };
}

export async function draftOwnerReply(params: {
  apiKey: string;
  businessName: string;
  context: string;
  history: OwnerChatTurn[];
  latest: string;
}): Promise<{ ok: true; draft: OwnerDraft } | { ok: false; error: string }> {
  const { apiKey, businessName, context, history, latest } = params;

  const system =
    "You are the private back-office assistant for \"" + businessName + "\" on WhatsApp. " +
    "You are talking to the SHOP OWNER, never a customer. You see live business data in named blocks.\n\n" +
    "Rules:\n" +
    "- Ground every number in the blocks and quote it EXACTLY. Never invent, estimate, or extrapolate.\n" +
    "- Reads (sales, orders, stock counts, low stock, best sellers, prices): answer directly, lead with the numbers, keep it under 8 short lines.\n" +
    "- Writes: when the owner wants to CHANGE something, emit exactly one action and keep reply to ONE short sentence; the system sends its own confirmation request.\n" +
    "    set_stock {product, variant?, value}: value is the NEW TOTAL quantity. For a relative change (add 5, remove 2) compute the new total from STOCK ON HAND; if you cannot see the current count, ask for the exact new total instead of guessing.\n" +
    "    set_price {product, variant?, value}: value is the NEW price in NAIRA as a plain integer.\n" +
    "    For both: product must be the exact CATALOG name. A product with Options also needs variant set to the EXACT Choices label; if the owner did not pin one down, ask which (group values by option) and emit no action.\n" +
    "    add_product {name, price, stock}: a brand new product. price in naira, stock as a count; if either is missing, ask for it and emit no action.\n" +
    "    set_product_active {product, active}: hide a product from sale (active false) or bring it back (active true). Remove, hide, archive, delist, take down mean active false; never treat those words as a stock change to zero.\n" +
    "    mark_order_paid {order} and cancel_order {order}: order is the exact ref shown in PENDING ORDERS or RECENT ORDERS, without the #. If the owner names a customer, find that customer's ref in the blocks; if no ref matches, say so and emit no action.\n" +
    "    set_policy {title, content}: any rule or info the customer bot should quote to buyers: refund or return policy, warranty, opening hours, how to pay, delivery promise. Title short ('Refund policy', 'Opening hours'); content is the owner's wording, cleaned up.\n" +
    "- Onboarding: SETTINGS AND SETUP shows what is configured. If the owner just linked or seems unsure, point to the next not-set item using its example phrasing, one at a time.\n" +
    "- Settings that are app-only (say so briefly, do not emit an action): fulfillment mode, delivery areas and fees, low stock level, autopay, BizBot mode, catalogue page, store address, logo, product photos, customer records, payouts.\n" +
    "- Tone: crisp, numbers first, plain text, no emojis.\n\n" +
    "Respond with ONLY this JSON, no markdown fences, no prose:\n" +
    "{\"reply\":\"<message to the owner>\",\"action\":null}\n" +
    "or\n" +
    "{\"reply\":\"<one short sentence>\",\"action\":{\"kind\":\"<one of the kinds above>\", ...the fields defined for that kind}}";

  const historyLines = history
    .slice(-10)
    .map((t) => (t.direction === "in" ? "Owner: " : "Assistant: ") + t.body)
    .join("\n");

  const user =
    "BUSINESS DATA:\n" + context + "\n\n" +
    "CONVERSATION (most recent last):\n" +
    (historyLines ? historyLines + "\n" : "") +
    "Owner: " + latest;

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
        model: OWNER_MODEL,
        max_tokens: 600,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (e) {
    console.error("[owner/brain] fetch failed", e);
    return { ok: false, error: "AI service unreachable" };
  }

  if (!res.ok) {
    console.error("[owner/brain] anthropic non-200", res.status);
    return { ok: false, error: "AI service error" };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "AI response unreadable" };
  }

  const parsed = safeJson(extractText(data));
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "AI response not JSON" };
  const p = parsed as Record<string, unknown>;
  const reply = typeof p.reply === "string" ? p.reply.trim() : "";
  if (!reply) return { ok: false, error: "AI reply empty" };

  const action =
    p.action && typeof p.action === "object"
      ? parseAction(p.action as Record<string, unknown>)
      : null;

  return { ok: true, draft: { reply, action } };
}
