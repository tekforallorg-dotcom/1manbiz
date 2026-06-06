/**
 * AI customer-reply drafting.
 *
 * Grounds replies in three sources: product CATALOG, DELIVERY zones, and
 * business KNOWLEDGE (policies / FAQ). Two-step prompt for Haiku 4.5: the model
 * first DECIDES (intent + which single data block answers the latest message +
 * whether that block was already sent), then writes the reply from only that
 * block. Returns { reply, confidence }; unclear confidence defaults to "low"
 * so the autonomous gate suppresses.
 *
 * Bookings are capability-gated: the booking intent, the CURRENT TIME anchor,
 * and the booking proposal appear in the prompt ONLY when the caller passes
 * offersBookings = true (service or hybrid businesses). offersBookings is
 * optional and defaults to false, so product-only businesses (and any caller
 * that omits it) never see booking machinery and the AI never tries to schedule.
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

export interface ReplyKnowledgeItem {
  title: string;
  content: string;
}

export interface ReplyLine {
  sender_role: "customer" | "vendor" | "ai";
  body_text: string;
}

export interface BookingProposal {
  starts_at: string; // "YYYY-MM-DDTHH:MM" in WAT (UTC+1), as resolved by the model
  title: string;
}

export type DraftReplyResult =
  | { ok: true; reply: string; confidence: "high" | "low"; booking?: BookingProposal }
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
  knowledgeItems?: ReplyKnowledgeItem[];
  tone: string;
  language: string;
  offersBookings?: boolean;
}): Promise<DraftReplyResult> {
  const { apiKey, messages, catalog, tone, language } = args;
  const deliveryZones = args.deliveryZones ?? [];
  const knowledgeItems = args.knowledgeItems ?? [];
  const offersBookings = args.offersBookings ?? false;

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

  const knowledgeBlock =
    knowledgeItems.length > 0
      ? knowledgeItems.map((k) => "- " + k.title + ": " + k.content).join("\n")
      : "(no policies or extra info provided)";

  const intentList = offersBookings
    ? "product, delivery, policy, order, booking, greeting, other"
    : "product, delivery, policy, order, greeting, other";

  const bookingSourceLine = offersBookings
    ? "    booking -> none (the customer wants to schedule an appointment or secure a slot at a specific day and time: book me for, can I come Friday 2pm, schedule me for tomorrow)\n"
    : "";

  const bookingRule = offersBookings
    ? "- booking intent: if the customer named a specific day AND time, set booking.wants true, booking.starts_at to that moment as YYYY-MM-DDTHH:MM in 24h WAT resolved against CURRENT TIME below, and booking.title to a short label (the service, else 'Appointment'); write the reply as a brief line that you have noted it and the shop will confirm. If the day or time is vague, set booking.wants false and ask for a specific day and time. Never invent a time the customer did not give.\n"
    : "";

  const jsonSchema = offersBookings
    ? '{"intent":"product|delivery|policy|order|booking|greeting|other","source":"catalog|delivery|knowledge|none","already_sent":true|false,"booking":{"wants":true|false,"starts_at":"YYYY-MM-DDTHH:MM","title":"<short label>"},"reply":"<message to send>","confidence":"high|low"}'
    : '{"intent":"product|delivery|policy|order|greeting|other","source":"catalog|delivery|knowledge|none","already_sent":true|false,"reply":"<message to send>","confidence":"high|low"}';

  const system =
    "You are the WhatsApp assistant for a small shop. Reply to the customer's MOST RECENT message, grounded only in the shop's data.\n\n" +
    "You have four inputs: CATALOG (products, prices, stock), DELIVERY (areas and fees), KNOWLEDGE (policies and info: refunds, returns, warranty, hours, payment methods), and CONVERSATION (recent lines; 'Shop:' is the vendor and your own past replies).\n\n" +
    "STEP 1, DECIDE from the latest 'Customer:' line only:\n" +
    "- intent: one of " + intentList + "\n" +
    "- source: the ONE block that answers it:\n" +
    "    product -> CATALOG (what do you have, do you have X, price of X, is X in stock, colours)\n" +
    "    delivery -> DELIVERY (where do you ship, cost or time to ship to X)\n" +
    "    policy -> KNOWLEDGE (refunds, returns, warranty, hours, and HOW TO PAY: pay on delivery, POD, transfer, card, deposit)\n" +
    "    order -> CATALOG (I want X, I will take 2)\n" +
    bookingSourceLine +
    "    greeting -> none (hi, hello, good morning, with no question)\n" +
    "    other -> none (complaint, haggling, payment claim, unclear, anything else)\n" +
    "  The LATEST message decides the intent. If the topic changed from earlier, follow the NEW message; do not continue the old topic.\n" +
    "- already_sent: true if that exact block (the zones list, a price list, a greeting) is already visible in a 'Shop:' line above.\n\n" +
    "STEP 2, REPLY obeying the decision:\n" +
    "- Use ONLY the block named by source. Never paste a different block. If source is 'none', send no list.\n" +
    "- Lead with the actual answer in one sentence (yes or no, the price, the policy). Add only what the question needs.\n" +
    "- If already_sent is true, do NOT paste that block again; answer the new point in words and refer back ('as listed above').\n" +
    "- Quote names, prices, fees, and policies EXACTLY as written. Never invent or estimate. Never address the customer by a name unless they gave it in the conversation.\n" +
    "- order intent: confirm item, quantity, and line total from CATALOG, and ask for delivery area or name if missing. Do NOT say the order is placed; the shop owner sends the payment link.\n" +
    bookingRule +
    "- If source is 'none' because it is a complaint, haggling, a payment claim, or a custom request, or KNOWLEDGE does not cover a policy question: reply 'Let me check with the shop and get back to you shortly' and set confidence 'low'.\n\n" +
    "confidence: send-readiness of this reply. Set 'high' for any reply that is safe to send now: a grounded answer from the named block, a greeting, an order confirmation, a captured booking, or a booking clarifying question asking for the missing day or time. Set 'low' ONLY when the reply is the 'let me check with the shop' holding reply (complaint, haggling, payment claim, or a policy KNOWLEDGE does not cover); those wait for the vendor.\n" +
    "Tone: warm, brief, human, like a real shop attendant on WhatsApp. No 'Thank you for your inquiry'. No emojis unless the customer used one. " +
    "Language: '" + language + "'. Style: '" + tone + "'.\n\n" +
    "Respond with ONLY this JSON, no markdown fences, no prose:\n" +
    jsonSchema;

  const nowLabel = new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
  const nowBlock = offersBookings ? "CURRENT TIME (WAT, UTC+1): " + nowLabel + "\n\n" : "";

  const user =
    nowBlock +
    "CATALOG (name | price | availability):\n" +
    catalogBlock +
    "\n\nDELIVERY (area: fee (note)):\n" +
    deliveryBlock +
    "\n\nKNOWLEDGE (shop policies & info):\n" +
    knowledgeBlock +
    "\n\nCONVERSATION (oldest to newest):\n" +
    recent +
    "\n\nDecide on the final 'Customer:' line, then reply. Return ONLY the JSON.";

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

  const confidence: "high" | "low" = obj.confidence === "high" ? "high" : "low";

  // Parse an optional booking proposal (only when this business offers
  // bookings). Surfaced only when the model flags wants=true and gives a
  // concrete start; otherwise undefined so the caller takes the reply-only path.
  let booking: BookingProposal | undefined;
  if (offersBookings) {
    const bp = obj.booking;
    if (typeof bp === "object" && bp !== null) {
      const bo = bp as Record<string, unknown>;
      const wants = bo.wants === true;
      const startsAt = typeof bo.starts_at === "string" ? bo.starts_at.trim() : "";
      const title = typeof bo.title === "string" ? bo.title.trim() : "";
      if (wants && startsAt) {
        booking = { starts_at: startsAt, title: title || "Appointment" };
      }
    }
  }

  // Log the routing decision so we can see WHY BizBot answered as it did
  // (visible in Vercel runtime logs). Observability only, no behaviour change.
  console.log("[ai/draft-reply] decision", {
    intent: typeof obj.intent === "string" ? obj.intent : "?",
    source: typeof obj.source === "string" ? obj.source : "?",
    already_sent: obj.already_sent === true,
    offers_bookings: offersBookings,
    booking_wants: booking !== undefined,
    confidence,
  });

  return { ok: true, reply, confidence, booking };
}
