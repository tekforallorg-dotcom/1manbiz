import { supabase } from "./supabase";

export type CustomerStats = {
  name: string | null;
  totalOrders: number;
  totalSpentKobo: number;
  lastPurchaseAt: string | null;
  openOrders: number;
  openOrderId: string | null;
};

type CustomerRow = {
  name: string | null;
  total_orders: number | null;
  total_spent_kobo: number | null;
  last_purchase_at: string | null;
};
type OrderIdRow = { id: string };

export async function fetchCustomerStats(customerId: string): Promise<CustomerStats | null> {
  const { data: cust, error: custErr } = await supabase
    .from("customers")
    .select("name, total_orders, total_spent_kobo, last_purchase_at")
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
  };
}
