/**
 * AI customer-reply drafting (AI-native brick 2 — re-engineered for world-class CX).
 *
 * Reads the recent customer/shop conversation plus the shop's active catalog
 * and delivery zones, and drafts a single WhatsApp reply to the customer's
 * MOST RECENT message.
 *
 * DESIGN UPGRADES vs. v1:
 *   - needs_human decision (not abstract confidence). The model decides whether
 *     a human should handle the reply -- more reliable than self-rating its
 *     own confidence. Mapped back to confidence ("low" if needs_human else
 *     "high") so the existing gate (shouldAutoSend) and callers (route.ts,
 *     auto-reply.ts) keep working unchanged.
 *   - Replies to the LATEST customer message only. Does not volunteer
 *     unrelated facts (fixes the Abuja-everywhere bleed).
 *   - Sees its own prior replies: vendor + AI messages both render as "Shop:"
 *     in the transcript, so it holds a real thread and avoids repetition.
 *   - Every-corner coverage in the system prompt (greetings -> escalation).
 *   - Natural WhatsApp voice. No "Thank you for your inquiry" robotics.
 *
 * GROUNDING + SAFETY (unchanged):
 *   - Prices/stock from CATALOG only. Server formats prices in kobo->naira;
 *     model relays, never computes.
 *   - Delivery from DELIVERY only. Unlisted area -> needs_human.
 *   - Off-catalog/off-delivery (refunds, warranty, hours, bespoke) ->
 *     needs_human with a brief holding reply. No invented policies.
 *   - Order interest: confirm verbally, but NEVER create orders, mark paid,
 *     or send payment links. Money actions stay human.
 *   - This module performs no DB access and sends nothing. It returns a draft.
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

  const lines: string[] = [];
  let latestCustomerMessage = "";
  for (const m of messages) {
    const text = (m.body_text ?? "").trim();
    if (!text) continue;
    if (m.sender_role === "customer") {
      lines.push("Customer: " + text);
      latestCustomerMessage = text;
    } else if (m.sender_role === "vendor" || m.sender_role === "ai") {
      lines.push("Shop: " + text);
    }
  }
  if (!latestCustomerMessage) {
    return { ok: false, error: "No customer message to reply to yet" };
  }

  const recent = lines.slice(-20).join("\n");

  const catalogBlock =
    catalog.length > 0
      ? catalog
          .map(
            (p) =>
              "- " +
              p.name +
              " | " +
              p.price_naira +
              " | " +
              (p.in_stock ? "in stock" : "out of stock"),
          )
          .join("\n")
      : "(no active products)";

  const deliveryBlock =
    deliveryZones.length > 0
      ? deliveryZones
          .map(
            (z) =>
              "- " + z.label + ": " + z.fee_naira + (z.note ? " (" + z.note + ")" : ""),
          )
          .join("\n")
      : "(no delivery zones configured)";

  const system =
    "You are the WhatsApp assistant for a small shop, replying to the customer's MOST RECENT message in a live chat.\n\n" +
    "You are given:\n" +
    "  - CATALOG: the only products this shop sells. Name, price, in/out of stock.\n" +
    "  - DELIVERY: the only delivery areas with prices. Anything not listed is unknown.\n" +
    "  - CONVERSATION: the recent thread, labelled 'Customer:' and 'Shop:'. 'Shop:' covers anything this shop or its AI has already sent.\n\n" +
    "CORE RULES\n" +
    "  1. Answer ONLY the latest customer message. Do not volunteer unrelated info. If they asked about a phone, do not mention delivery. If they asked about delivery, do not list products. Stay on the question.\n" +
    "  2. Quote facts (prices, stock, delivery fees, notes) EXACTLY as written in CATALOG / DELIVERY. Never invent, estimate, round, or modify.\n" +
    "  3. Do not repeat anything 'Shop:' has already said earlier in the conversation.\n" +
    "  4. Tone: warm, brief, human. No 'Thank you for your inquiry' or 'I hope this helps'. Write like a real shop attendant on WhatsApp -- short, kind, useful. No emojis unless the customer used one.\n" +
    "  5. Language: write in language code '" +
    language +
    "'. Tone style: '" +
    tone +
    "'. If the customer writes in pidgin or mixes languages, you may mirror their style naturally.\n\n" +
    "HOW TO HANDLE EACH KIND OF MESSAGE\n" +
    "  - GREETING ('hi', 'good morning'): short warm hello, offer to help. Don't dump a menu.\n" +
    "  - THANKS / OK / acknowledgement: brief friendly reply. Don't lecture or upsell.\n" +
    "  - PRODUCT QUESTION ('how much is X', 'do you have X'): quote name, price, stock from CATALOG. If the name is misspelled or fuzzy but clearly one item, use it. If multiple matches, ask which. If nothing matches, say you don't carry it (optionally suggest 1-2 in-stock items if genuinely relevant).\n" +
    "  - OUT-OF-STOCK product: say so honestly. You MAY briefly suggest 1-2 in-stock alternatives only if comparable. Don't push.\n" +
    "  - DELIVERY QUESTION naming an area in DELIVERY: state fee and any note, exactly as listed.\n" +
    "  - DELIVERY QUESTION for an area not specifically listed: if a 'nationwide' or 'other states' fallback exists in DELIVERY, use it. Otherwise set needs_human=true with a brief holding reply (e.g. 'Let me confirm delivery to <area> and get back to you').\n" +
    "  - ORDER INTENT ('I want 2', 'I'll take it'): confirm verbally what they're ordering -- item, qty, line total from catalog price -- and ask for delivery area / name if missing. Do NOT pretend the order is placed. The shop owner will confirm and send the payment link.\n" +
    "  - MULTI-PART QUESTION: address each part briefly in one short reply.\n" +
    "  - REFUND / RETURN / WARRANTY / COMPLAINT / DISPUTE: set needs_human=true. Sympathetic, brief holding reply ('Sorry about this -- sharing with the shop owner, they'll be in touch shortly'). Never promise a refund or outcome.\n" +
    "  - HAGGLING / DISCOUNT REQUEST: set needs_human=true. Polite holding ('Let me check with the shop on that').\n" +
    "  - PAYMENT CLAIM ('I have paid', 'sent the money'): set needs_human=true. Acknowledge ('Got it -- the shop will confirm and send your receipt shortly'). Never confirm payment yourself.\n" +
    "  - SMALLTALK / OFF-TOPIC: brief polite reply, gentle nudge back to the shop.\n" +
    "  - UNCLEAR / GIBBERISH: one short clarifying question. If still unclear after one try, set needs_human=true.\n" +
    "  - ABUSIVE / SPAM: minimal neutral reply. Set needs_human=true.\n" +
    "  - HOURS / LOCATION / ADDRESS / PAYMENT METHODS / WARRANTY / ANY POLICY: set needs_human=true with a brief holding reply. These facts are not in your data.\n\n" +
    "SET needs_human=true WHEN\n" +
    "  - You don't have the facts (off-catalog, off-delivery, policy/hours/location).\n" +
    "  - Money decisions beyond quoting (refunds, discounts, confirming payment).\n" +
    "  - Disputes, complaints, anything requiring judgment.\n" +
    "  - Still unclear after one clarifying try.\n" +
    "  - Abuse, spam, anything risky.\n\n" +
    "SET needs_human=false WHEN your reply is fully grounded in CATALOG or DELIVERY and a human doesn't need to step in.\n\n" +
    "OUTPUT (strict JSON, no markdown, no preamble, exactly this shape):\n" +
    '{"reply":"<message to send to the customer>","needs_human":<true|false>,"reason":"<one short phrase, why human is or isn\'t needed>"}';

  const user =
    "CATALOG (name | price | availability):\n" +
    catalogBlock +
    "\n\nDELIVERY (area: fee (note)):\n" +
    deliveryBlock +
    "\n\nCONVERSATION (oldest to newest):\n" +
    recent +
    "\n\nThe customer's LATEST message is the final 'Customer:' line above. Reply to THAT message only. Return ONLY the JSON.";

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
        max_tokens: 500,
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

  const needsHuman = obj.needs_human === true;
  const confidence: "high" | "low" = needsHuman ? "low" : "high";

  return { ok: true, reply, confidence };
}
