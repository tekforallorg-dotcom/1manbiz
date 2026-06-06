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

export interface OrderLineView {
  name: string;
  quantity: number;
  line_total_kobo: number;
}

export interface OrderSnapshot {
  orderId: string;
  subtotalKobo: number;
  lines: OrderLineView[];
}

export interface OrderItemInput {
  name: string;
  qty: number;
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

// Read-only snapshot (used for the prompt context, so no write on every inbound).
async function readSnapshot(admin: AdminClient, orderId: string): Promise<OrderSnapshot> {
  const { data: items } = await admin
    .from("order_items")
    .select("name_snapshot, quantity, line_total_kobo")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  const lines: OrderLineView[] = (items ?? []).map((r) => ({
    name: r.name_snapshot as string,
    quantity: Number(r.quantity),
    line_total_kobo: Number(r.line_total_kobo),
  }));
  const subtotalKobo = lines.reduce((s, l) => s + l.line_total_kobo, 0);
  return { orderId, subtotalKobo, lines };
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
    if (product.stock_quantity <= 0) {
      outOfStock.push(product.name);
      continue;
    }
    const qty = cleanQty(it.qty);
    const lineTotal = product.price_kobo * qty;
    subtotalKobo += lineTotal;
    rows.push({
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: product.price_kobo,
      quantity: qty,
      line_total_kobo: lineTotal,
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
  if (product.stock_quantity <= 0) return { ok: false, code: "out_of_stock", names: [product.name] };
  const addQty = cleanQty(item.qty);

  const { data: line } = await admin
    .from("order_items")
    .select("id, quantity, price_kobo_snapshot")
    .eq("order_id", orderId)
    .eq("product_id", product.id)
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
      price_kobo_snapshot: product.price_kobo,
      quantity: addQty,
      line_total_kobo: product.price_kobo * addQty,
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
