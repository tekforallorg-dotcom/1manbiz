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

  const catalogBlock =
    catalog.length > 0
      ? catalog
          .map((p) => {
            let line =
              "- " + p.name + " | " + p.price_naira + " | " + (p.in_stock ? "in stock" : "out of stock");
            if (p.options && p.options.length > 0) {
              line += "\n  Options: " + p.options.join(", ");
            }
            if (p.variants && p.variants.length > 0) {
              line +=
                "\n" +
                p.variants
                  .map(
                    (v) =>
                      "  * " + v.label + " | " + v.price_naira + " | " + (v.in_stock ? "in stock" : "out of stock"),
                  )
                  .join("\n");
            }
            return line;
          })
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

  const intentList =
    "product, delivery, policy, order, " + (offersBookings ? "booking, " : "") + "greeting, other";

  const bookingSourceLine = offersBookings
    ? "    booking -> none (schedule, change, or cancel an appointment: book me for, can I come Friday 2pm, change my booking, cancel my appointment)\n"
    : "";

  const orderRule = offersOrders
    ? "- order intent, set the order object and reply (the customer is buying products):\n" +
      "    If there is NO current order and the customer names item(s) from CATALOG: action 'create', items = each product with its quantity, using the CATALOG name EXACTLY. Reply confirming the items and the total and that the shop owner will send the payment link.\n" +
      "    If there IS a current order: to add an item action 'add_item' with items [{name, qty}]; to change a quantity action 'set_quantity' with items [{name, qty}] as the new total quantity; to remove an item action 'remove_item' with items [{name}]. Reply with the updated order summary.\n" +
      "    To swap one item for another (change X to Y, swap X for Y, replace X with Y, make it Y instead): action 'replace_item' with EXACTLY two items [{name: the item to remove, qty: 0}, {name: the item to add, qty}] using CATALOG names; the first is removed and the second is added. Do NOT use set_quantity for a swap.\n" +
      "    If the customer confirms the order or says that is all (confirm, that is all, done, looks good, go ahead): action 'confirm'.\n" +
      "    If the customer declines or defers instead of confirming (no; no thanks; not now; maybe later; another time; I will get back to you): action 'decline'. A bare 'no' here means decline, never confirm. Do NOT re-show the order summary and do NOT ask again; a short acknowledgement will be sent.\n" +
      "    To cancel the order: action 'cancel'.\n" +
      "    If a current order exists and the customer asks to start a separate new order: action 'none'; say you will add to their current order or can cancel it first, and ask which.\n" +
      "    If the item the customer names matches more than one product in CATALOG (a brand or product family named with no specific model): action 'none'; do not choose for them. List the matching products with their prices and ask which one they want. Only act once they name a specific product.\n" +
      "    If a requested product is not in CATALOG: action 'none'; ask them to choose from the list. Never invent a product or a price.\n" +
      "    If a product is shown as out of stock in CATALOG: action 'none'; tell the customer it is out of stock and offer an in-stock item. Do not add an out-of-stock product.\n" +
      "    Never say the order is placed or paid; the shop owner sends the payment link.\n"
    : "- order intent: confirm item, quantity, and line total from CATALOG, and ask for delivery area or name if missing. Do NOT say the order is placed; the shop owner sends the payment link.\n";

  const fulfillmentRule =
    offersOrders && aiSendsPaymentLink
      ? "- fulfillment, ONLY after the order is confirmed (the CURRENT ORDER line states what is AWAITING). Do not ask or restate these questions; the shop sends the exact wording. Classify the customer's latest answer:\n" +
        "    Choosing or switching delivery vs pickup: action 'set_fulfillment', fulfillment = 'delivery' or 'pickup'.\n" +
        "    Giving the delivery area (when awaiting delivery area): action 'set_delivery_area', area = the matching DELIVERY zone label EXACTLY if it clearly matches one, else area = exactly what the customer said. Never set a fee; the shop resolves it from the zone.\n" +
        (offersBookings
          ? "    Giving the pickup day and time (when awaiting pickup time): action 'set_pickup_time', pickup_at = that moment as YYYY-MM-DDTHH:MM in 24h WAT resolved against CURRENT TIME below. If the day or time is vague, action 'none' and ask for a specific day and time. Never invent a time the customer did not give.\n"
          : "") +
        "    Choosing how to pay (when awaiting payment method): action 'set_payment_method', payment_method = 'online' (pay online, card, transfer, pay now), 'on_delivery' (pay on delivery, POD) for delivery, or 'at_store' (pay at the store) for pickup.\n"
      : "";

  const bookingRule = offersBookings
    ? "- booking intent, set the booking object:\n" +
      "    If there is NO current booking and the customer gave a specific day AND time: action 'create', starts_at = that moment as YYYY-MM-DDTHH:MM in 24h WAT resolved against CURRENT TIME below, title = the service named or 'Appointment' (short, no invented descriptions). Reply that you noted it and will confirm.\n" +
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
    ? '"order":{"action":"' + orderActionEnum + '","items":[{"name":"<exact catalog product name>","qty":<integer>}]' + orderFulfillmentFields + '},'
    : "";
  const intentOptions =
    "product|delivery|policy|order|" + (offersBookings ? "booking|" : "") + "greeting|other";
  const jsonSchema =
    '{"intent":"' + intentOptions + '","source":"catalog|delivery|knowledge|none","already_sent":true|false,' +
    bookingField + orderField +
    '"reply":"<message to send>","confidence":"high|low"}';

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
    "- Some CATALOG products have OPTIONS (like Color or Storage), shown as indented '*' variant lines each with its own price and availability. When the customer asks what options, colours, sizes, or storage are available, or whether a specific one is in stock, answer from that product's variant lines and quote the variant label and price EXACTLY. If a customer wants a product that has options, ask which option they want before treating it as a specific item.\n" +
    orderRule +
    fulfillmentRule +
    bookingRule +
    "- If source is 'none' because it is a complaint, haggling, a payment claim, or a custom request, or KNOWLEDGE does not cover a policy question: reply 'Let me check with the shop and get back to you shortly' and set confidence 'low'.\n\n" +
    "confidence: send-readiness of this reply. Set 'high' for any reply that is safe to send now: a grounded answer from the named block, a greeting, any order create/add/remove/quantity/cancel/confirm/set fulfillment/set delivery area/set pickup time/set payment method or order question, or any booking create/edit/cancel/confirm or a booking clarifying question. Set 'low' ONLY when the reply is the 'let me check with the shop' holding reply (complaint, haggling, payment claim, or a policy KNOWLEDGE does not cover); those wait for the vendor.\n" +
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
        items.push({ name: nm, qty });
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

  return { ok: true, reply, confidence, bookingAction, orderAction };
}
