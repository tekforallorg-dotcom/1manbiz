import { supabase } from "./supabase";

export interface NewOrderLine {
  product_id: string;
  name: string;            // snapshot at order time
  price_kobo: number;      // snapshot at order time
  quantity: number;
}

export interface CreateOrderInput {
  businessId: string;
  customerId: string;
  items: NewOrderLine[];
  notes?: string;
}

// Creates an order + its line items. Supabase JS lacks transactions, so we do
// sequential inserts. If items insert fails after order insert succeeds, we
// log it and surface the orphaned order id so the caller can handle the partial
// state (best-effort, MVP). For production-grade atomicity, move this to a
// Postgres RPC function in a future slice.
export async function createOrder(
  input: CreateOrderInput,
): Promise<{ id?: string; error?: string }> {
  if (input.items.length === 0) return { error: "Order must have at least one item." };

  const subtotalKobo = input.items.reduce(
    (sum, it) => sum + it.quantity * it.price_kobo,
    0,
  );

  // 1) Insert order
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      business_id: input.businessId,
      customer_id: input.customerId,
      source: "manual",
      status: "pending",
      subtotal_kobo: subtotalKobo,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    console.error("[order-create] order insert error:", orderErr);
    return { error: orderErr?.message ?? "Could not create order." };
  }

  // 2) Insert line items
  const lines = input.items.map((it) => ({
    order_id: order.id,
    product_id: it.product_id,
    name_snapshot: it.name,
    price_kobo_snapshot: it.price_kobo,
    quantity: it.quantity,
    line_total_kobo: it.quantity * it.price_kobo,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(lines);

  if (itemsErr) {
    console.error("[order-create] items insert error:", itemsErr);
    return { id: order.id, error: itemsErr.message };
  }

  return { id: order.id };
}
