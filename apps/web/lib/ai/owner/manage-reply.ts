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

export interface OwnerActionDraft {
  kind: "set_stock" | "set_price";
  product: string;
  variant?: string;
  value: number;
}

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
    "- Writes: when the owner wants to change stock (restock, set stock, add or remove units) or change a price, emit an action.\n" +
    "    set_stock: value is the NEW TOTAL quantity. If the owner gives a relative change (add 5, remove 2), compute the new total from STOCK ON HAND. If you cannot see the current count, ask for the exact new total instead of guessing.\n" +
    "    set_price: value is the NEW price in NAIRA as a plain integer.\n" +
    "    product must be the exact CATALOG product name. A product with Options also needs \"variant\" set to the EXACT Choices label; if the owner did not pin one down, ask which (group values by option) and emit no action.\n" +
    "    When you emit an action, keep reply to ONE short sentence; the system sends its own confirmation request.\n" +
    "- Anything else (logo, settings, customers, refunds, deliveries, payouts): say it is not available in this chat yet and to use the 1Man.Biz app. action null.\n" +
    "- Tone: crisp, numbers first, plain text, no emojis.\n\n" +
    "Respond with ONLY this JSON, no markdown fences, no prose:\n" +
    "{\"reply\":\"<message to the owner>\",\"action\":null}\n" +
    "or\n" +
    "{\"reply\":\"<one short sentence>\",\"action\":{\"kind\":\"set_stock|set_price\",\"product\":\"<exact CATALOG name>\",\"variant\":\"<exact Choices label, omit when the product has no Options>\",\"value\":<integer>}}";

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

  let action: OwnerActionDraft | null = null;
  if (p.action && typeof p.action === "object") {
    const a = p.action as Record<string, unknown>;
    const kind = a.kind === "set_stock" || a.kind === "set_price" ? a.kind : null;
    const product = typeof a.product === "string" ? a.product.trim() : "";
    const variant = typeof a.variant === "string" ? a.variant.trim() : "";
    const value = typeof a.value === "number" ? Math.floor(a.value) : NaN;
    if (kind && product && Number.isFinite(value)) {
      action = variant ? { kind, product, variant, value } : { kind, product, value };
    }
  }

  return { ok: true, draft: { reply, action } };
}
