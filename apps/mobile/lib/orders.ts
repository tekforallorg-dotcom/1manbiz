import { supabase } from "./supabase";
import type { OrderStatus, RecentOrder } from "./dashboard";

export type OrderFilter = OrderStatus | "all";

// Reuses RecentOrder shape from dashboard.ts since the surface is identical:
// customer name, total, status, created_at. Detail screen will add items + notes.
export async function fetchOrders(
  businessId: string,
  filter: OrderFilter = "all",
): Promise<RecentOrder[]> {
  let query = supabase
    .from("orders")
    .select("id, subtotal_kobo, status, created_at, customers(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[orders] fetch error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    subtotal_kobo: row.subtotal_kobo,
    status: row.status,
    created_at: row.created_at,
    customer_name: Array.isArray(row.customers)
      ? row.customers[0]?.name ?? null
      : row.customers?.name ?? null,
  }));
}
