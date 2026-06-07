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

export type CustomerProfile = {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  notes: string | null;
  totalOrders: number;
  totalSpentKobo: number;
  lastPurchaseAt: string | null;
  createdAt: string | null;
};

type ProfileRow = {
  id: string;
  name: string | null;
  phone_e164: string | null;
  email: string | null;
  notes: string | null;
  total_orders: number | null;
  total_spent_kobo: number | null;
  last_purchase_at: string | null;
  created_at: string | null;
};

// Full profile for the customer detail screen (includes phone/email, unlike
// fetchCustomerStats which is tuned for the in-chat panel).
export async function fetchCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164, email, notes, total_orders, total_spent_kobo, last_purchase_at, created_at")
    .eq("id", customerId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("[customer-stats] profile failed", error);
    return null;
  }
  const c = data as ProfileRow;
  return {
    id: c.id,
    name: c.name ?? "Customer",
    phoneE164: c.phone_e164 ?? "",
    email: c.email ?? null,
    notes: c.notes ?? null,
    totalOrders: c.total_orders ?? 0,
    totalSpentKobo: c.total_spent_kobo ?? 0,
    lastPurchaseAt: c.last_purchase_at ?? null,
    createdAt: c.created_at ?? null,
  };
}

export type CustomerReceipt = {
  id: string;
  subtotalKobo: number;
  paidAt: string | null;
  receiptCode: string;
  itemSummary: string;
};

type ReceiptQueryRow = {
  id: string;
  subtotal_kobo: number | null;
  paid_at: string | null;
  receipt_code: string;
  order_items: { name_snapshot: string; quantity: number }[] | null;
};

// Paid orders with a receipt for one customer, newest first, with a short
// item summary built from order_items snapshots.
export async function fetchCustomerReceipts(customerId: string): Promise<CustomerReceipt[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, subtotal_kobo, paid_at, receipt_code, order_items(name_snapshot, quantity)")
    .eq("customer_id", customerId)
    .eq("status", "paid")
    .not("receipt_code", "is", null)
    .order("paid_at", { ascending: false });
  if (error) {
    console.error("[customer-stats] receipts failed", error);
    return [];
  }
  return ((data as ReceiptQueryRow[] | null) ?? []).map((o) => {
    const items = o.order_items ?? [];
    const first = items[0];
    let itemSummary = "Receipt";
    if (first) {
      const q = first.quantity > 1 ? first.quantity + " x " : "";
      itemSummary = q + first.name_snapshot;
      if (items.length > 1) itemSummary += " + " + (items.length - 1) + " more";
    }
    return {
      id: o.id,
      subtotalKobo: o.subtotal_kobo ?? 0,
      paidAt: o.paid_at,
      receiptCode: o.receipt_code,
      itemSummary,
    };
  });
}

// Update a customer's display name and notes (owner-scoped via RLS).
export async function updateCustomer(
  customerId: string,
  fields: { name: string; notes: string },
): Promise<{ ok: boolean; error?: string }> {
  const name = fields.name.trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  const trimmedNotes = fields.notes.trim();
  const { error } = await supabase
    .from("customers")
    .update({ name, notes: trimmedNotes.length > 0 ? trimmedNotes : null })
    .eq("id", customerId);
  if (error) {
    console.error("[customer-stats] update failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// Most recent conversation id for a customer, or null if they have not chatted.
export async function findCustomerConversation(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, last_message_at")
    .eq("customer_id", customerId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) {
    console.error("[customer-stats] find conversation failed", error);
    return null;
  }
  const rows = (data as { id: string }[] | null) ?? [];
  return rows[0]?.id ?? null;
}
