import { supabase } from "./supabase";

export type CustomerStats = {
  name: string | null;
  totalOrders: number;
  totalSpentKobo: number;
  lastPurchaseAt: string | null;
  openOrders: number;
  openOrderId: string | null;
  notes: string | null;
};

type CustomerRow = {
  name: string | null;
  total_orders: number | null;
  total_spent_kobo: number | null;
  last_purchase_at: string | null;
  notes: string | null;
};
type OrderIdRow = { id: string };

export type OpenOrder = {
  id: string;
  subtotalKobo: number;
  createdAt: string;
  itemSummary: string;
};

type OpenOrderRow = {
  id: string;
  subtotal_kobo: number | null;
  created_at: string;
  order_items: { name_snapshot: string; quantity: number }[] | null;
};

// Pending orders for one customer, newest first, with a short item summary
// built from order_items snapshots (e.g. "2 x iPhone 17 Pro" or "iPhone + 1 more").
export async function fetchOpenOrders(customerId: string): Promise<OpenOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, subtotal_kobo, created_at, order_items(name_snapshot, quantity)")
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[customer-stats] open orders failed", error);
    return [];
  }
  return ((data as OpenOrderRow[] | null) ?? []).map((o) => {
    const items = o.order_items ?? [];
    const first = items[0];
    let itemSummary = "Order";
    if (first) {
      const q = first.quantity > 1 ? first.quantity + " x " : "";
      itemSummary = q + first.name_snapshot;
      if (items.length > 1) itemSummary += " + " + (items.length - 1) + " more";
    }
    return {
      id: o.id,
      subtotalKobo: o.subtotal_kobo ?? 0,
      createdAt: o.created_at,
      itemSummary,
    };
  });
}

export async function fetchCustomerStats(customerId: string): Promise<CustomerStats | null> {
  const { data: cust, error: custErr } = await supabase
    .from("customers")
    .select("name, total_orders, total_spent_kobo, last_purchase_at, notes")
    .eq("id", customerId)
    .maybeSingle();
  if (custErr || !cust) return null;
  const c = cust as CustomerRow; // mobile client is untyped; shape asserted above

  const { data: openRows } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const rows = (openRows as OrderIdRow[] | null) ?? [];
  const openOrderId = rows[0]?.id ?? null;

  return {
    name: c.name ?? null,
    totalOrders: c.total_orders ?? 0,
    totalSpentKobo: c.total_spent_kobo ?? 0,
    lastPurchaseAt: c.last_purchase_at ?? null,
    openOrders: rows.length,
    openOrderId,
    notes: c.notes ?? null,
  };
}

export async function updateCustomerNotes(
  customerId: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("customers")
    .update({ notes: notes.length > 0 ? notes : null })
    .eq("id", customerId);
  if (error) {
    console.error("[customer-stats] update notes failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
