/**
 * Order actions for the autonomous AI (product / hybrid businesses).
 *
 * The conversational twin of the vendor-confirmed createOrderFromProposalAction:
 * same safe write conventions (source 'whatsapp_ai', status 'pending', NGN,
 * prices re-resolved from the live catalog and never trusted from the model,
 * orphan recovery on a failed item insert) but driven from the WhatsApp webhook
 * on the service-role admin client (no vendor session), and extended with the
 * edits the chat needs: add an item, change a quantity, remove an item, cancel.
 *
 * The model resolves products by NAME; every name is re-resolved here to an
 * active catalog product (exact, case-insensitive) and the price is taken from
 * the product, so the model can never set money. Orders stay pending and the
 * owner sends the Paystack link; nothing here moves money.
 *
 * One open order at a time: loadCurrentOrder resolves the single order every
 * edit targets, and createOrder refuses a second one while it exists.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type FulfillmentType = "delivery" | "pickup";
export type PaymentMethod = "online" | "on_delivery" | "at_store";

export interface OrderLineView {
  name: string;
  quantity: number;
  line_total_kobo: number;
}

export interface OrderSnapshot {
  orderId: string;
  subtotalKobo: number;
  lines: OrderLineView[];
  confirmedAt: string | null;
  fulfillmentType: FulfillmentType | null;
  deliveryZoneId: string | null;
  deliveryAddress: string | null;
  deliveryFeeKobo: number;
  paymentMethod: PaymentMethod | null;
  pickupAt: string | null;
}

export interface OrderItemInput {
  name: string;
  qty: number;
  variant?: string;
}

interface ResolvedProduct {
  id: string;
  name: string;
  price_kobo: number;
  stock_quantity: number;
}

const MAX_QTY = 999;

function cleanQty(n: number): number {
  const q = Math.floor(Number(n));
  if (!Number.isFinite(q) || q < 1) return 1;
  if (q > MAX_QTY) return MAX_QTY;
  return q;
}

// Exact, case-insensitive match against the ACTIVE catalog. ilike with no
// wildcard is a whole-string case-insensitive compare, so "iphone 17 air"
// matches "iPhone 17 Air" but a partial like "iphone" does not. Returns null on
// no match so the caller asks the customer to choose; the model never sets a price.
async function resolveActiveProduct(
  admin: AdminClient,
  businessId: string,
  name: string,
): Promise<ResolvedProduct | null> {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const { data } = await admin
    .from("products")
    .select("id, name, price_kobo, status, stock_quantity")
    .eq("business_id", businessId)
    .eq("status", "active")
    .ilike("name", trimmed)
    .limit(1);
  if (!data || data.length === 0) return null;
  const p = data[0] as Record<string, unknown>;
  return {
    id: p.id as string,
    name: p.name as string,
    price_kobo: Number(p.price_kobo),
    stock_quantity: Number(p.stock_quantity),
  };
}

interface ResolvedVariant {
  id: string;
  label: string;
  price_kobo: number;
  stock_quantity: number;
}

// Resolve an ACTIVE variant of a product by its label (whole-string,
// case-insensitive). Returns null when there is no such active variant, so the
// caller treats it like an unresolved name and asks the customer to choose. A
// null variant price inherits the product price; the model never sets price.
async function resolveActiveVariant(
  admin: AdminClient,
  productId: string,
  fallbackPriceKobo: number,
  label: string,
): Promise<ResolvedVariant | null> {
  const trimmed = (label || "").trim();
  if (!trimmed) return null;
  const { data } = await admin
    .from("product_variants")
    .select("id, label, price_kobo, stock_quantity, is_active")
    .eq("product_id", productId)
    .eq("is_active", true)
    .ilike("label", trimmed)
    .limit(1);
  if (!data || data.length === 0) return null;
  const v = data[0] as Record<string, unknown>;
  return {
    id: v.id as string,
    label: v.label as string,
    price_kobo: Number((v.price_kobo as number | null) ?? fallbackPriceKobo),
    stock_quantity: Number(v.stock_quantity),
  };
}

// Read-only snapshot (used for the prompt context, so no write on every inbound).
async function readSnapshot(admin: AdminClient, orderId: string): Promise<OrderSnapshot> {
  const { data: items } = await admin
    .from("order_items")
    .select("name_snapshot, variant_label_snapshot, quantity, line_total_kobo")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  const lines: OrderLineView[] = (items ?? []).map((r) => {
    const baseName = r.name_snapshot as string;
    const vlabel = (r.variant_label_snapshot as string | null) ?? null;
    return {
      name: vlabel ? baseName + " - " + vlabel : baseName,
      quantity: Number(r.quantity),
      line_total_kobo: Number(r.line_total_kobo),
    };
  });
  const subtotalKobo = lines.reduce((s, l) => s + l.line_total_kobo, 0);

  const { data: orderRow } = await admin
    .from("orders")
    .select("confirmed_at, fulfillment_type, delivery_zone_id, delivery_address, delivery_fee_kobo, payment_method, pickup_at")
    .eq("id", orderId)
    .maybeSingle();
  const o = (orderRow ?? {}) as Record<string, unknown>;

  return {
    orderId,
    subtotalKobo,
    lines,
    confirmedAt: (o.confirmed_at as string | null) ?? null,
    fulfillmentType: (o.fulfillment_type as FulfillmentType | null) ?? null,
    deliveryZoneId: (o.delivery_zone_id as string | null) ?? null,
    deliveryAddress: (o.delivery_address as string | null) ?? null,
    deliveryFeeKobo: Number(o.delivery_fee_kobo ?? 0),
    paymentMethod: (o.payment_method as PaymentMethod | null) ?? null,
    pickupAt: (o.pickup_at as string | null) ?? null,
  };
}

// Snapshot that ALSO recomputes and persists orders.subtotal_kobo. The paid
// trigger rolls subtotal_kobo into the customer's lifetime spend, so this runs
// after every line change to keep the stored total exact.
async function syncSnapshot(admin: AdminClient, orderId: string): Promise<OrderSnapshot> {
  const snap = await readSnapshot(admin, orderId);
  await admin.from("orders").update({ subtotal_kobo: snap.subtotalKobo }).eq("id", orderId);
  return snap;
}

// The customer's current open (pending) order in this business, most recent first.
export async function loadCurrentOrder(
  admin: AdminClient,
  businessId: string,
  customerId: string,
): Promise<OrderSnapshot | null> {
  const { data } = await admin
    .from("orders")
    .select("id, status, created_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return readSnapshot(admin, (data as Record<string, unknown>).id as string);
}

export type CreateOrderResult =
  | { ok: true; order: OrderSnapshot }
  | { ok: false; code: "order_exists"; order: OrderSnapshot }
  | { ok: false; code: "unresolved"; names: string[] }
  | { ok: false; code: "out_of_stock"; names: string[] }
  | { ok: false; code: "empty" }
  | { ok: false; code: "error"; message: string };

// Create a pending order. Refuses if the customer already has an open order
// (returns it so the caller asks to add-or-cancel). Any unresolved name aborts.
export async function createOrder(
  admin: AdminClient,
  businessId: string,
  customerId: string,
  items: OrderItemInput[],
): Promise<CreateOrderResult> {
  const existing = await loadCurrentOrder(admin, businessId, customerId);
  if (existing) return { ok: false, code: "order_exists", order: existing };

  const wanted = (items ?? []).filter((it) => it && (it.name || "").trim());
  if (wanted.length === 0) return { ok: false, code: "empty" };

  const rows: Array<{
    product_id: string;
    name_snapshot: string;
    price_kobo_snapshot: number;
    quantity: number;
    line_total_kobo: number;
    variant_id?: string;
    variant_label_snapshot?: string;
  }> = [];
  const unresolved: string[] = [];
  const outOfStock: string[] = [];
  let subtotalKobo = 0;

  for (const it of wanted) {
    const product = await resolveActiveProduct(admin, businessId, it.name);
    if (!product) {
      unresolved.push(it.name.trim());
      continue;
    }
    const variantLabel = (it.variant || "").trim();
    let variant: ResolvedVariant | null = null;
    if (variantLabel) {
      variant = await resolveActiveVariant(admin, product.id, product.price_kobo, variantLabel);
      if (!variant) {
        unresolved.push(product.name + " (" + variantLabel + ")");
        continue;
      }
    }
    const effPrice = variant ? variant.price_kobo : product.price_kobo;
    const effStock = variant ? variant.stock_quantity : product.stock_quantity;
    if (effStock <= 0) {
      outOfStock.push(variant ? product.name + " (" + variant.label + ")" : product.name);
      continue;
    }
    const qty = cleanQty(it.qty);
    const lineTotal = effPrice * qty;
    subtotalKobo += lineTotal;
    rows.push({
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: effPrice,
      quantity: qty,
      line_total_kobo: lineTotal,
      ...(variant
        ? { variant_id: variant.id, variant_label_snapshot: variant.label }
        : {}),
    });
  }

  if (unresolved.length > 0) return { ok: false, code: "unresolved", names: unresolved };
  if (outOfStock.length > 0) return { ok: false, code: "out_of_stock", names: outOfStock };
  if (rows.length === 0) return { ok: false, code: "empty" };

  const { data: orderRow, error: orderError } = await admin
    .from("orders")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      source: "whatsapp_ai",
      status: "pending",
      subtotal_kobo: subtotalKobo,
      currency: "NGN",
    })
    .select("id")
    .single();
  if (orderError || !orderRow) {
    return { ok: false, code: "error", message: orderError?.message ?? "order insert failed" };
  }

  const orderId = orderRow.id as string;
  const withOrder = rows.map((r) => ({ ...r, order_id: orderId }));
  const { error: itemsError } = await admin.from("order_items").insert(withOrder);
  if (itemsError) {
    await admin.from("orders").delete().eq("id", orderId); // orphan recovery
    return { ok: false, code: "error", message: itemsError.message };
  }

  return { ok: true, order: await syncSnapshot(admin, orderId) };
}

export type EditOrderResult =
  | { ok: true; order: OrderSnapshot }
  | { ok: false; code: "unresolved"; names: string[] }
  | { ok: false; code: "out_of_stock"; names: string[] }
  | { ok: false; code: "not_in_order"; names: string[] }
  | { ok: false; code: "error"; message: string };

// Add an item, or bump its quantity if that product is already a line (never a
// duplicate line). The existing line's snapshot price is preserved on a bump.
export async function addItem(
  admin: AdminClient,
  businessId: string,
  orderId: string,
  item: OrderItemInput,
): Promise<EditOrderResult> {
  const product = await resolveActiveProduct(admin, businessId, item.name);
  if (!product) return { ok: false, code: "unresolved", names: [(item.name || "").trim()] };

  const variantLabel = (item.variant || "").trim();
  let variant: ResolvedVariant | null = null;
  if (variantLabel) {
    variant = await resolveActiveVariant(admin, product.id, product.price_kobo, variantLabel);
    if (!variant) {
      return { ok: false, code: "unresolved", names: [product.name + " (" + variantLabel + ")"] };
    }
  }
  const effPrice = variant ? variant.price_kobo : product.price_kobo;
  const effStock = variant ? variant.stock_quantity : product.stock_quantity;
  const displayName = variant ? product.name + " (" + variant.label + ")" : product.name;
  if (effStock <= 0) return { ok: false, code: "out_of_stock", names: [displayName] };
  const addQty = cleanQty(item.qty);

  const lineSel = admin
    .from("order_items")
    .select("id, quantity, price_kobo_snapshot")
    .eq("order_id", orderId)
    .eq("product_id", product.id);
  const { data: line } = await (
    variant ? lineSel.eq("variant_id", variant.id) : lineSel.is("variant_id", null)
  )
    .limit(1)
    .maybeSingle();

  if (line) {
    const l = line as Record<string, unknown>;
    const unit = Number(l.price_kobo_snapshot);
    const newQty = cleanQty(Number(l.quantity) + addQty);
    const { error } = await admin
      .from("order_items")
      .update({ quantity: newQty, line_total_kobo: unit * newQty })
      .eq("id", l.id as string);
    if (error) return { ok: false, code: "error", message: error.message };
  } else {
    const { error } = await admin.from("order_items").insert({
      order_id: orderId,
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: effPrice,
      quantity: addQty,
      line_total_kobo: effPrice * addQty,
      ...(variant
        ? { variant_id: variant.id, variant_label_snapshot: variant.label }
        : {}),
    });
    if (error) return { ok: false, code: "error", message: error.message };
  }

  return { ok: true, order: await syncSnapshot(admin, orderId) };
}

// Set an absolute quantity for a product already on the order. qty <= 0 removes
// the line (quantity has a > 0 check in the DB, so zero means delete).
export async function setQuantity(
  admin: AdminClient,
  businessId: string,
  orderId: string,
  item: OrderItemInput,
): Promise<EditOrderResult> {
  const product = await resolveActiveProduct(admin, businessId, item.name);
  if (!product) return { ok: false, code: "unresolved", names: [(item.name || "").trim()] };

  const { data: line } = await admin
    .from("order_items")
    .select("id, price_kobo_snapshot")
    .eq("order_id", orderId)
    .eq("product_id", product.id)
    .limit(1)
    .maybeSingle();
  if (!line) return { ok: false, code: "not_in_order", names: [product.name] };
  const l = line as Record<string, unknown>;

  const qtyRaw = Math.floor(Number(item.qty));
  if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) {
    const { error } = await admin.from("order_items").delete().eq("id", l.id as string);
    if (error) return { ok: false, code: "error", message: error.message };
  } else {
    const qty = qtyRaw > MAX_QTY ? MAX_QTY : qtyRaw;
    const unit = Number(l.price_kobo_snapshot);
    const { error } = await admin
      .from("order_items")
      .update({ quantity: qty, line_total_kobo: unit * qty })
      .eq("id", l.id as string);
    if (error) return { ok: false, code: "error", message: error.message };
  }

  return { ok: true, order: await syncSnapshot(admin, orderId) };
}

// Remove a product line. Matches by resolved product id, falling back to the
// name snapshot so a line whose product was deleted can still be removed.
export async function removeItem(
  admin: AdminClient,
  businessId: string,
  orderId: string,
  name: string,
): Promise<EditOrderResult> {
  const product = await resolveActiveProduct(admin, businessId, name);
  let lineId: string | null = null;

  if (product) {
    const { data: line } = await admin
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_id", product.id)
      .limit(1)
      .maybeSingle();
    if (line) lineId = (line as Record<string, unknown>).id as string;
  }
  if (!lineId) {
    const { data: line } = await admin
      .from("order_items")
      .select("id")
      .eq("order_id", orderId)
      .ilike("name_snapshot", (name || "").trim())
      .limit(1)
      .maybeSingle();
    if (line) lineId = (line as Record<string, unknown>).id as string;
  }
  if (!lineId) return { ok: false, code: "not_in_order", names: [(name || "").trim()] };

  const { error } = await admin.from("order_items").delete().eq("id", lineId);
  if (error) return { ok: false, code: "error", message: error.message };

  return { ok: true, order: await syncSnapshot(admin, orderId) };
}

export async function cancelOrder(
  admin: AdminClient,
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Mark the cart confirmed (idempotent: only sets the first time, preserving the
// original confirm time). Confirming locks the items and moves the order into
// fulfillment collection; the order stays pending until paid.
export async function markConfirmed(admin: AdminClient, orderId: string): Promise<OrderSnapshot> {
  await admin
    .from("orders")
    .update({ confirmed_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("confirmed_at", null);
  return readSnapshot(admin, orderId);
}

// Set delivery vs pickup. Switching to pickup clears any delivery zone/fee so a
// changed mind cannot leave a stale delivery charge on the order.
export async function setFulfillment(
  admin: AdminClient,
  orderId: string,
  type: FulfillmentType,
): Promise<OrderSnapshot> {
  const patch: Record<string, unknown> = { fulfillment_type: type };
  if (type === "pickup") {
    patch.delivery_zone_id = null;
    patch.delivery_address = null;
    patch.delivery_fee_kobo = 0;
  }
  await admin.from("orders").update(patch).eq("id", orderId);
  return readSnapshot(admin, orderId);
}

export type SetDeliveryAreaResult =
  | { ok: true; order: OrderSnapshot; zoneLabel: string; feeKobo: number }
  | { ok: false; code: "no_match"; zones: Array<{ label: string; feeKobo: number }> }
  | { ok: false; code: "error"; message: string };

// Resolve the customer's stated area to an ACTIVE delivery zone and store the
// zone-defined fee on the order. The model never sets the fee; it only proposes
// the area, exactly as it proposes product names. No zone match -> no_match with
// the list of areas we cover so the caller can say we do not deliver there.
export async function setDeliveryArea(
  admin: AdminClient,
  businessId: string,
  orderId: string,
  area: string,
): Promise<SetDeliveryAreaResult> {
  const trimmed = (area || "").trim();
  const { data: zoneRows } = await admin
    .from("delivery_zones")
    .select("id, label, fee_kobo, active, sort_order")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const zones = (zoneRows ?? []) as Array<{ id: string; label: string; fee_kobo: number }>;
  const cover = () => zones.map((z) => ({ label: z.label, feeKobo: Number(z.fee_kobo) }));
  if (zones.length === 0 || !trimmed) return { ok: false, code: "no_match", zones: cover() };

  const a = trimmed.toLowerCase();
  const norm = (s: string) => s.toLowerCase();
  const match =
    zones.find((z) => norm(z.label) === a) ||
    zones.find((z) => a.length >= 3 && (norm(z.label).includes(a) || a.includes(norm(z.label)))) ||
    zones.find((z) =>
      norm(z.label)
        .split(/[^a-z0-9]+/)
        .some((tok) => tok.length >= 3 && a.includes(tok)),
    );
  if (!match) return { ok: false, code: "no_match", zones: cover() };

  const { error } = await admin
    .from("orders")
    .update({
      delivery_zone_id: match.id,
      delivery_address: trimmed,
      delivery_fee_kobo: Number(match.fee_kobo),
    })
    .eq("id", orderId);
  if (error) return { ok: false, code: "error", message: error.message };

  return {
    ok: true,
    order: await readSnapshot(admin, orderId),
    zoneLabel: match.label,
    feeKobo: Number(match.fee_kobo),
  };
}

// Record how the customer will pay. online -> a Paystack link is sent for goods
// + delivery; on_delivery / at_store stay unpaid until the vendor marks paid.
export async function setPaymentMethod(
  admin: AdminClient,
  orderId: string,
  method: PaymentMethod,
): Promise<OrderSnapshot> {
  await admin.from("orders").update({ payment_method: method }).eq("id", orderId);
  return readSnapshot(admin, orderId);
}

// Record the scheduled pickup time on the order. The linked booking row (created
// by the caller) is the calendar entry; pickup_at is the order-flow marker.
export async function setPickupAt(
  admin: AdminClient,
  orderId: string,
  iso: string,
): Promise<OrderSnapshot> {
  await admin.from("orders").update({ pickup_at: iso }).eq("id", orderId);
  return readSnapshot(admin, orderId);
}
