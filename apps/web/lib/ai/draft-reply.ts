/**
 * AI customer-reply drafting.
 *
 * Two-step prompt for Haiku 4.5: the model first DECIDES (intent + which single
 * data block answers the latest message + already_sent), then writes the reply
 * from only that block. Grounds replies in product CATALOG, DELIVERY zones, and
 * business KNOWLEDGE. Returns { reply, confidence }; unclear confidence defaults
 * to "low" so the autonomous gate suppresses.
 *
 * Bookings are capability-gated (offersBookings) and orders are capability-gated
 * (offersOrders), both default false. When enabled, the prompt gains the
 * matching action plus a CURRENT BOOKING / CURRENT ORDER context line so the
 * model edits the existing entity instead of duplicating or looping. The server
 * executes the action and composes the authoritative reply; the model never
 * sets money and never marks anything paid.
 */

import { renderCatalogBlock } from "@/lib/ai/catalog";

export const REPLY_MODEL = "claude-haiku-4-5-20251001";

export interface ReplyCatalogProduct {
  name: string;
  price_naira: string;
  in_stock: boolean;
  options?: string[];
  variants?: { label: string; price_naira: string; in_stock: boolean }[];
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

export interface BookingAction {
  kind: "create" | "edit" | "cancel" | "confirm" | "decline";
  starts_at?: string; // "YYYY-MM-DDTHH:MM" in WAT (UTC+1); create requires it, edit may use it
  title?: string;     // create/edit label
}

export interface OrderActionItem {
  name: string;
  qty: number;
  variant?: string;
}

export interface OrderAction {
  kind:
    | "create" | "add_item" | "remove_item" | "set_quantity" | "replace_item"
    | "cancel" | "confirm" | "decline"
    | "set_fulfillment" | "set_delivery_area" | "set_payment_method" | "set_pickup_time";
  items: OrderActionItem[];
  fulfillment?: "delivery" | "pickup";
  area?: string;
  payment_method?: "online" | "on_delivery" | "at_store";
  pickup_at?: string;
}

export type DraftReplyResult =
  | {
      ok: true;
      reply: string;
      confidence: "high" | "low";
      bookingAction?: BookingAction;
      orderAction?: OrderAction;
      showProduct?: { name: string; variant?: string };
    }
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
  currentBooking?: { title: string; whenLabel: string } | null;
  offersOrders?: boolean;
  currentOrder?: {
    label: string;
    confirmed?: boolean;
    fulfillmentType?: "delivery" | "pickup" | null;
    deliveryLabel?: string | null;
    awaiting?: "items" | "fulfillment" | "delivery_area" | "payment_method" | "pickup_time" | "complete";
  } | null;
  aiSendsPaymentLink?: boolean;
  recentPaidOrders?: string | null;
}): Promise<DraftReplyResult> {
  const { apiKey, messages, catalog, tone, language } = args;
  const deliveryZones = args.deliveryZones ?? [];
  const knowledgeItems = args.knowledgeItems ?? [];
  const offersBookings = args.offersBookings ?? false;
  const currentBooking = args.currentBooking ?? null;
  const offersOrders = args.offersOrders ?? false;
  const currentOrder = args.currentOrder ?? null;
  const aiSendsPaymentLink = args.aiSendsPaymentLink ?? false;
  const recentPaidOrders = args.recentPaidOrders ?? null;

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

  const catalogBlock = renderCatalogBlock(catalog);

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

  const intentList =
    "product, delivery, policy, order, " + (offersBookings ? "booking, " : "") + "greeting, other";

  const bookingSourceLine = offersBookings
    ? "    booking -> none (schedule, change, or cancel an appointment: book me for, can I come Friday 2pm, change my booking, cancel my appointment)\n"
    : "";

  const orderRule = offersOrders
    ? "- order intent (the customer is buying). Act like a careful salesperson: identify exactly ONE product, PREVIEW it, and add it to the cart ONLY after the customer agrees. Never guess a product or a variant, and never add an item the customer has not just agreed to.\n" +
      "    STEP A, identify ONE product. If what they name matches more than one CATALOG product (a family or brand with no specific model, like 'iphone' when there is a 17 Air and a 17 Pro): action 'none'; list the matching products with prices and ask which one. If they ask for a product or model you do NOT stock (like 'ipad pro' when you only carry the iPad Air): action 'none'; tell them you do not carry that one, name the closest product you DO stock with its price, and ask if that interests them. If it is not in CATALOG at all: action 'none'; ask them to pick from what you have. Never invent a product or price and never choose for them.\n" +
      "    STEP B, pin the variant. A variant is pinned ONLY when the customer has explicitly stated EVERY option axis (for example BOTH storage AND color). Naming just one axis (only a color, or only a storage) pins that one axis and no more. If ANY axis is still unstated: action 'none' and leave 'show' unset; ask only for the missing axes, grouped (Storage: ...; Color: ...). NEVER pick, default, or guess a missing axis, not even the cheapest or most common value. If they name a combination that is not a Choice or is marked out of stock: action 'none'; say that one is not available and offer the nearest in-stock Choices.\n" +
      "    STEP C, preview, do NOT order yet. Once you have ONE concrete in-stock product (and its exact Choices variant when it has Options): set the 'show' object to that product (name, and variant when it has Options) and reply with ONE short line naming it and its price and asking to add it to the cart, like 'iPhone 17 Pro, 512GB / Red - N2,200,000. Add it to your cart?'. Do NOT set the order object on this turn; the photo is sent automatically.\n" +
      "    STEP D, commit. When the customer agrees to the previewed item (yes, add it, ok, sure, go ahead): set the order object now and leave 'show' unset. action 'create' if there is no current cart, else 'add_item', items = [{name, qty, variant when the product has Options}] for the exact product you just previewed. If they decline the preview (no, not that one): action 'none'; ask what they would prefer instead.\n" +
      "    Changing the cart: to change a quantity action 'set_quantity' [{name, qty}] as the new total; to remove an item action 'remove_item' [{name}].\n" +
      "    Swapping (change X to Y, replace X with Y, make it Y instead): run STEP A and STEP B on Y first (ask which one and which variant when Y is a family or has Options; never guess), PREVIEW Y, and only after the customer agrees action 'replace_item' with EXACTLY two items [{name: X, qty: 0}, {name: Y, qty, variant when Y has Options}]. Never swap to a guessed product or variant.\n" +
      "    If the customer confirms the whole cart or says that is all (confirm, that is all, done, looks good, go ahead with the order): action 'confirm'.\n" +
      "    If the customer declines or defers the whole order (no thanks, not now, maybe later, another time): action 'decline'. A bare 'no' right after a cart summary means decline, never confirm. Do NOT re-show the cart and do NOT ask again.\n" +
      "    To cancel or clear the cart (cancel, clear cart, empty cart, start over, remove everything): action 'cancel'.\n" +
      "    If a current cart exists and the customer asks to start a separate new order: action 'none'; offer to add to their current cart or clear it first, and ask which.\n" +
      "    Never say the order is placed or paid; the shop owner sends the payment link.\n"
    : "- order intent: confirm item, quantity, and line total from CATALOG, and ask for delivery area or name if missing. Do NOT say the order is placed; the shop owner sends the payment link.\n";

  const fulfillmentRule =
    offersOrders && aiSendsPaymentLink
      ? "- fulfillment, ONLY after the order is confirmed (the CURRENT ORDER line states what is AWAITING). Do not ask or restate these questions; the shop sends the exact wording. Classify the customer's latest answer:\n" +
        "    Choosing or switching delivery vs pickup: action 'set_fulfillment', fulfillment = 'delivery' or 'pickup'.\n" +
        "    Giving the delivery area (when awaiting delivery area): action 'set_delivery_area', area = the matching DELIVERY zone label EXACTLY if it clearly matches one, else area = exactly what the customer said. Never set a fee; the shop resolves it from the zone.\n" +
        (offersBookings
          ? "    Giving the pickup day and time (when awaiting pickup time): action 'set_pickup_time', pickup_at = that moment as YYYY-MM-DDTHH:MM in 24h WAT resolved against CURRENT TIME below. A day plus a clock time is SPECIFIC even with no connector word: 'tomorrow 9am', 'tomorrow at 9am', 'tmrw 8', 'today 5pm', '9am tomorrow', 'sat 10am' all resolve. Today, tomorrow, and weekday names are days; 9am is 09:00, 5pm is 17:00, a bare morning hour like 9 is 09:00. Treat it as vague ONLY when a day or a clock time is genuinely missing (just 'morning', 'later', 'sometime', 'anytime'): then action 'none' and ask for a specific day and time. Never invent a time the customer did not give.\n"
          : "") +
        "    Choosing how to pay (when awaiting payment method): action 'set_payment_method', payment_method = 'online' (pay online, card, transfer, pay now), 'on_delivery' (pay on delivery, POD) for delivery, or 'at_store' (pay at the store) for pickup.\n"
      : "";

  const bookingRule = offersBookings
    ? "- booking intent, set the booking object:\n" +
      "    If there is NO current booking and the customer gave a specific day AND time: action 'create', starts_at = that moment as YYYY-MM-DDTHH:MM in 24h WAT resolved against CURRENT TIME below, title = the service named or 'Appointment' (short, no invented descriptions). A day plus a clock time is specific even with no connector word ('tomorrow 9am', 'tmrw 8', 'today 5pm', 'sat 10am'); today, tomorrow, and weekday names are days, 9am is 09:00, 5pm is 17:00. Reply that you noted it and will confirm.\n" +
      "    If there IS a current booking and the customer wants to move it (a new day or time) or rename it: action 'edit', starts_at = the new moment if the time changed, title = the new label if renamed. Do NOT create a second booking. Reply that you updated it.\n" +
      "    If there IS a current booking and the customer confirms it (confirm, yes that is right, that works, go ahead): action 'confirm'.\n" +
      "    If the customer declines or defers instead of confirming (no; no thanks; not now; maybe later; another time; I will get back to you): action 'decline'. A bare 'no' here means decline, never confirm. Do NOT re-show the booking summary and do NOT ask again; a short acknowledgement will be sent.\n" +
      "    If the customer wants to cancel the current booking: action 'cancel'. Reply that you cancelled it.\n" +
      "    If the day or time is vague (no specific time): action 'none' and ask for a specific day and time. Never invent a time the customer did not give.\n"
    : "";

  const bookingField = offersBookings
    ? '"booking":{"action":"none|create|edit|cancel|confirm|decline","starts_at":"YYYY-MM-DDTHH:MM","title":"<short label>"},'
    : "";
  const orderActionEnum = aiSendsPaymentLink
    ? "none|create|add_item|remove_item|set_quantity|replace_item|cancel|confirm|decline|set_fulfillment|set_delivery_area|set_payment_method" +
      (offersBookings ? "|set_pickup_time" : "")
    : "none|create|add_item|remove_item|set_quantity|replace_item|cancel|confirm|decline";
  const orderFulfillmentFields = aiSendsPaymentLink
    ? ',"fulfillment":"delivery|pickup","area":"<delivery area>","payment_method":"online|on_delivery|at_store"' +
      (offersBookings ? ',"pickup_at":"YYYY-MM-DDTHH:MM"' : "")
    : "";
  const orderField = offersOrders
    ? '"order":{"action":"' + orderActionEnum + '","items":[{"name":"<exact catalog product name>","qty":<integer>,"variant":"<exact Choices label once the customer has chosen, omit if the product has no Options>"}]' + orderFulfillmentFields + '},'
    : "";
  const showField = offersOrders
    ? '"show":{"name":"<exact catalog product name>","variant":"<exact Choices label once chosen, omit if no Options or not chosen yet>"},'
    : "";
  const intentOptions =
    "product|delivery|policy|order|" + (offersBookings ? "booking|" : "") + "greeting|other";
  const jsonSchema =
    '{"intent":"' + intentOptions + '","source":"catalog|delivery|knowledge|none","already_sent":true|false,' +
    bookingField + orderField + showField +
    '"reply":"<message to send>","confidence":"high|low"}';

  const showRule = offersOrders
    ? "- SHOWING A PRODUCT PHOTO: when the customer asks to SEE a product (a pic, picture, photo, image, 'show me', 'send a pic of X', 'what does it look like'): set \"show\".name to the EXACT catalog product name. If that product has Options, only set \"show\" once the customer has pinned exactly one Choice and set \"show\".variant to that exact Choices label; if they have not chosen yet, do NOT set \"show\", instead ask which option grouped by axis, exactly like ordering. If the product has no Options, set \"show\" right away. If the product is out of stock or not in the catalog, do NOT set \"show\"; say so in words. Keep the reply to one short line that introduces the photo, for example 'Here is the iPhone 17 Pro in 512GB / Red:'. Do not describe how it looks; the photo speaks for itself.\n"
    : "";
  const system =
    "You are the WhatsApp assistant for a small shop. Reply to the customer's MOST RECENT message, grounded only in the shop's data.\n\n" +
    "STYLE: keep replies short and plain. NEVER use an em dash or en dash anywhere in a reply; use a hyphen, a comma, or a separate sentence instead.\n\n" +
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
    "- OPTIONS and CHOICES: a CATALOG product may list Options (its axes, like Storage or Color) and Choices (every sellable combination as an exact label). A Choice showing a price in parentheses costs that price; all others cost the product price. A Choice marked 'out of stock' cannot be ordered.\n" +
    "    Questions about options: when the customer asks what colours, sizes, storage, or versions exist, or whether a specific one is available, answer from Options and Choices and quote labels and prices EXACTLY.\n" +
    "    One-message happy path: if the customer's message already pins down exactly one Choice (like 'iphone 17 pro 256gb black', in any word order or casing), do NOT ask again; that is the chosen variant, go straight to the preview (STEP C) with that exact Choices label.\n" +
    "    Partial choice: if they fixed some options but not all (say Color but not Storage), keep what they chose and ask ONLY for the missing option, listing its available values. Do NOT preview or order until every option is set, and never fill a missing option yourself.\n" +
    "    Unavailable choice: if they name a value or combination that is not in Choices, or one marked out of stock, say that exact one is not available and offer the nearest available Choices. Never invent a choice.\n" +
    "    When asking which option, list values grouped by option (Storage: 128GB, 256GB... Color: Black, White...), never the full combination list.\n" +
    "    Never set \"variant\" for a product with no Options. Once the choice is complete, ALWAYS set \"variant\" to the EXACT Choices label.\n" +
    orderRule +
    showRule +
    fulfillmentRule +
    bookingRule +
    "- If source is 'none' because it is a complaint, haggling, a payment claim, or a custom request, or KNOWLEDGE does not cover a policy question: reply 'Let me check with the shop and get back to you shortly' and set confidence 'low'.\n\n" +
    "confidence: send-readiness of this reply. Set 'high' for any reply that is safe to send now: a grounded answer from the named block, a greeting, any order create/add/remove/quantity/cancel/confirm/set fulfillment/set delivery area/set pickup time/set payment method or order question, any request to show a product photo, or any booking create/edit/cancel/confirm or a booking clarifying question. Set 'low' ONLY when the reply is the 'let me check with the shop' holding reply (complaint, haggling, payment claim, or a policy KNOWLEDGE does not cover); those wait for the vendor.\n" +
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
  const currentBookingBlock = offersBookings
    ? (currentBooking
        ? "CURRENT BOOKING: " + currentBooking.title + " on " + currentBooking.whenLabel + " (pending confirmation). Change or cancel THIS one; do not create another.\n\n"
        : "CURRENT BOOKING: none (no open booking). If an earlier message mentioned a booking, it is now closed and is NOT open. Do not say the customer already has a booking. Treat a new booking request as a brand-new booking (action 'create'). You may still answer a direct question about a past booking if the customer explicitly asks about it.\n\n")
    : "";
  const orderPhaseLine = ((): string => {
    if (!currentOrder) return "";
    const a = currentOrder.awaiting ?? "items";
    if (a === "fulfillment") return " Items are confirmed. The shop just asked DELIVERY or PICKUP; classify the customer's answer with set_fulfillment.";
    if (a === "delivery_area") return " Items confirmed, delivery chosen. The shop just asked which AREA to deliver to; classify the answer with set_delivery_area.";
    if (a === "pickup_time") return " Items confirmed, pickup chosen. The shop just asked for the pickup DAY and TIME; classify the answer with set_pickup_time.";
    if (a === "payment_method") return " Items confirmed" + (currentOrder.fulfillmentType ? ", " + currentOrder.fulfillmentType : "") + (currentOrder.deliveryLabel ? " to " + currentOrder.deliveryLabel : "") + ". The shop just asked HOW the customer wants to pay; classify the answer with set_payment_method.";
    if (a === "complete") return " This order is fully set; do not ask again.";
    return " Add to, change, or cancel THIS order; do not start a second one.";
  })();
  const currentOrderBlock = offersOrders
    ? (currentOrder
        ? "CURRENT ORDER: " + currentOrder.label + " (pending)." + orderPhaseLine + "\n\n"
        : "CURRENT ORDER: none (no open cart). If an earlier message in this chat mentioned an order (even one described as confirmed), it has since been paid or cancelled and is now closed; it is NOT an open cart. Do not say the customer already has an order, and do not offer to add to or cancel it. Treat any order request as a brand-new order (action 'create'). You may still answer a direct question about a past order if the customer explicitly asks about it.\n\n")
    : "";
  const recentPaidOrdersBlock =
    offersOrders && recentPaidOrders
      ? "RECENT PAID ORDERS (already completed, ranked newest first; entry 1 is the most recent):\n" + recentPaidOrders + "\nWhen the customer asks about their last or most recent paid order, answer with entry 1 exactly (its items, total, and receipt). Do not reorder this list and do not pick a different entry just because it matches the current cart's product. For an older order use the matching numbered entry. These are completed and are NOT the open cart.\n\n"
      : "";

  const user =
    nowBlock +
    currentBookingBlock +
    currentOrderBlock +
    recentPaidOrdersBlock +
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

  const confidence: "high" | "low" = obj.confidence === "high" ? "high" : "low";

  // Parse an optional booking action (only when this business offers bookings).
  let bookingAction: BookingAction | undefined;
  if (offersBookings) {
    const bp = obj.booking;
    if (typeof bp === "object" && bp !== null) {
      const bo = bp as Record<string, unknown>;
      const kind = bo.action;
      const startsAt = typeof bo.starts_at === "string" ? bo.starts_at.trim() : "";
      const title = typeof bo.title === "string" ? bo.title.trim() : "";
      if (kind === "cancel") {
        bookingAction = { kind: "cancel" };
      } else if (kind === "confirm") {
        bookingAction = { kind: "confirm" };
      } else if (kind === "decline") {
        bookingAction = { kind: "decline" };
      } else if (kind === "create") {
        if (startsAt) bookingAction = { kind: "create", starts_at: startsAt, title: title || "Appointment" };
      } else if (kind === "edit") {
        if (startsAt || title) bookingAction = { kind: "edit", starts_at: startsAt || undefined, title: title || undefined };
      }
    }
  }

  // Parse an optional order action (only when this business offers orders).
  let orderAction: OrderAction | undefined;
  if (offersOrders) {
    const op = obj.order;
    if (typeof op === "object" && op !== null) {
      const oo = op as Record<string, unknown>;
      const action = oo.action;
      const rawItems = Array.isArray(oo.items) ? oo.items : [];
      const items: OrderActionItem[] = [];
      for (const it of rawItems) {
        if (typeof it !== "object" || it === null) continue;
        const r = it as Record<string, unknown>;
        const nm = typeof r.name === "string" ? r.name.trim() : "";
        if (!nm) continue;
        let qty = typeof r.qty === "number" ? Math.floor(r.qty) : 1;
        if (!Number.isFinite(qty) || qty < 0) qty = 1;
        const variant = typeof r.variant === "string" ? r.variant.trim() : "";
        items.push(variant ? { name: nm, qty, variant } : { name: nm, qty });
      }
      const first = items.length > 0 ? items[0] : undefined;
      if (action === "cancel") {
        orderAction = { kind: "cancel", items: [] };
      } else if (action === "confirm") {
        orderAction = { kind: "confirm", items: [] };
      } else if (action === "decline") {
        orderAction = { kind: "decline", items: [] };
      } else if (action === "create" && items.length > 0) {
        orderAction = { kind: "create", items };
      } else if (action === "add_item" && first) {
        orderAction = { kind: "add_item", items: [first] };
      } else if (action === "remove_item" && first) {
        orderAction = { kind: "remove_item", items: [first] };
      } else if (action === "set_quantity" && first) {
        orderAction = { kind: "set_quantity", items: [first] };
      } else if (action === "replace_item" && items.length >= 2) {
        const toItem = items[1];
        if (first && toItem) orderAction = { kind: "replace_item", items: [first, toItem] };
      } else if (action === "set_fulfillment") {
        const f = oo.fulfillment === "pickup" ? "pickup" : oo.fulfillment === "delivery" ? "delivery" : null;
        if (f) orderAction = { kind: "set_fulfillment", items: [], fulfillment: f };
      } else if (action === "set_delivery_area") {
        const area = typeof oo.area === "string" ? oo.area.trim() : "";
        if (area) orderAction = { kind: "set_delivery_area", items: [], area };
      } else if (action === "set_pickup_time") {
        const pickupAt = typeof oo.pickup_at === "string" ? oo.pickup_at.trim() : "";
        if (pickupAt) orderAction = { kind: "set_pickup_time", items: [], pickup_at: pickupAt };
      } else if (action === "set_payment_method") {
        const pm = oo.payment_method;
        const method = pm === "online" || pm === "on_delivery" || pm === "at_store" ? pm : null;
        if (method) orderAction = { kind: "set_payment_method", items: [], payment_method: method };
      }
    }
  }

  console.log("[ai/draft-reply] decision", {
    intent: typeof obj.intent === "string" ? obj.intent : "?",
    source: typeof obj.source === "string" ? obj.source : "?",
    already_sent: obj.already_sent === true,
    offers_bookings: offersBookings,
    booking_action: bookingAction?.kind ?? "none",
    offers_orders: offersOrders,
    order_action: orderAction?.kind ?? "none",
    confidence,
  });

  // Parse an optional show-product request (a "send me a pic of X" intent).
  let showProduct: { name: string; variant?: string } | undefined;
  if (offersOrders) {
    const sp = obj.show;
    if (typeof sp === "object" && sp !== null) {
      const so = sp as Record<string, unknown>;
      const nm = typeof so.name === "string" ? so.name.trim() : "";
      if (nm) {
        const variant = typeof so.variant === "string" ? so.variant.trim() : "";
        showProduct = variant ? { name: nm, variant } : { name: nm };
      }
    }
  }

  return { ok: true, reply, confidence, bookingAction, orderAction, showProduct };
}
