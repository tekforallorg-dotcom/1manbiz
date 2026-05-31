import { supabase } from "./supabase";
import { startOfTodayIso } from "./format";

export type OrderStatus = "pending" | "paid" | "cancelled";

export interface DashboardTiles {
  revenueTodayKobo: number | null;   // null = query failed; render "—"
  ordersTodayCount: number | null;
  pendingCount: number | null;
  activeProductsCount: number | null;
}

export interface RecentOrder {
  id: string;
  subtotal_kobo: number;
  status: OrderStatus;
  created_at: string;
  customer_name: string | null;
}

export interface DashboardSummary {
  tiles: DashboardTiles;
  recentOrders: RecentOrder[];
}

// Fetches all dashboard data in parallel. Individual query failures degrade
// gracefully: the corresponding tile/list field is null and an error is logged.
export async function fetchDashboardSummary(businessId: string): Promise<DashboardSummary> {
  const startToday = startOfTodayIso();

  const [revRes, ordTodayRes, pendingRes, activeProdRes, recentRes] = await Promise.all([
    // Revenue today: sum subtotal_kobo where paid today
    supabase
      .from("orders")
      .select("subtotal_kobo")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", startToday),

    // Orders today: count of orders created today
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", startToday),

    // Pending: count of pending orders (all-time, vendor needs to action these)
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),

    // Active products: status active AND stock > 0
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active")
      .gt("stock_quantity", 0),

    // Recent orders: last 5 by created_at, with customer name
    supabase
      .from("orders")
      .select("id, subtotal_kobo, status, created_at, customers(name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (revRes.error) console.error("[dashboard] revenue query:", revRes.error);
  if (ordTodayRes.error) console.error("[dashboard] orders today query:", ordTodayRes.error);
  if (pendingRes.error) console.error("[dashboard] pending query:", pendingRes.error);
  if (activeProdRes.error) console.error("[dashboard] active products query:", activeProdRes.error);
  if (recentRes.error) console.error("[dashboard] recent orders query:", recentRes.error);

  const revenueTodayKobo = revRes.error
    ? null
    : (revRes.data ?? []).reduce((sum, row) => sum + (row.subtotal_kobo ?? 0), 0);

  // Supabase returns customers as an object when single FK, but the typed
  // helper sometimes infers it as an array. Normalise to a single object.
  const recentOrders: RecentOrder[] = recentRes.error
    ? []
    : (recentRes.data ?? []).map((row: any) => ({
        id: row.id,
        subtotal_kobo: row.subtotal_kobo,
        status: row.status,
        created_at: row.created_at,
        customer_name: Array.isArray(row.customers)
          ? row.customers[0]?.name ?? null
          : row.customers?.name ?? null,
      }));

  return {
    tiles: {
      revenueTodayKobo,
      ordersTodayCount: ordTodayRes.error ? null : ordTodayRes.count ?? 0,
      pendingCount: pendingRes.error ? null : pendingRes.count ?? 0,
      activeProductsCount: activeProdRes.error ? null : activeProdRes.count ?? 0,
    },
    recentOrders,
  };
}
