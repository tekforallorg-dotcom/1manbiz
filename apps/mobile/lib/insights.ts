import { supabase } from "./supabase";

export type TopProduct = { name: string; qty: number; revenueKobo: number };

export type InsightOrder = {
  status: string;
  subtotalKobo: number;
  paidAt: string | null;
  createdAt: string;
};

export type InsightItem = {
  orderId: string;
  name: string;
  quantity: number;
  lineTotalKobo: number;
};

export type InsightsData = {
  orders: InsightOrder[];
  paidItems: InsightItem[];
  paidAtByOrder: Record<string, string | null>;
};

export async function fetchInsightsData(businessId: string): Promise<InsightsData> {
  const empty: InsightsData = { orders: [], paidItems: [], paidAtByOrder: {} };

  const { data: ordersData, error } = await supabase
    .from("orders")
    .select("id, status, subtotal_kobo, paid_at, created_at")
    .eq("business_id", businessId);
  if (error || !ordersData) return empty;

  const orders: InsightOrder[] = [];
  const paidIds: string[] = [];
  const paidAtByOrder: Record<string, string | null> = {};

  for (const row of ordersData as { id: string; status: string; subtotal_kobo: number; paid_at: string | null; created_at: string }[]) {
    orders.push({ status: row.status, subtotalKobo: row.subtotal_kobo, paidAt: row.paid_at, createdAt: row.created_at });
    if (row.status === "paid") {
      paidIds.push(row.id);
      paidAtByOrder[row.id] = row.paid_at;
    }
  }

  let paidItems: InsightItem[] = [];
  if (paidIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, name_snapshot, quantity, line_total_kobo")
      .in("order_id", paidIds);
    if (itemsData) {
      paidItems = (itemsData as { order_id: string; name_snapshot: string; quantity: number; line_total_kobo: number }[]).map((it) => ({
        orderId: it.order_id,
        name: it.name_snapshot,
        quantity: it.quantity,
        lineTotalKobo: it.line_total_kobo,
      }));
    }
  }

  return { orders, paidItems, paidAtByOrder };
}

export type RangeKey = "7d" | "30d" | "90d" | "all";

export type WindowStats = {
  paidRevenueKobo: number;
  paidCount: number;
  aovKobo: number;
  outstandingKobo: number;
  pendingCount: number;
  series: number[];
  topProducts: TopProduct[];
};

export function rangeDays(range: RangeKey): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 365;
}

export function computeWindow(data: InsightsData, range: RangeKey): WindowStats {
  const days = rangeDays(range);
  const now = Date.now();
  const from = now - days * 24 * 60 * 60 * 1000;

  let paidRevenueKobo = 0;
  let paidCount = 0;
  let outstandingKobo = 0;
  let pendingCount = 0;
  const buckets = new Array<number>(days).fill(0);

  for (const o of data.orders) {
    if (o.status === "pending") {
      outstandingKobo += o.subtotalKobo;
      pendingCount += 1;
    }
    if (o.status === "paid" && o.paidAt) {
      const t = new Date(o.paidAt).getTime();
      if (t >= from && t <= now) {
        paidRevenueKobo += o.subtotalKobo;
        paidCount += 1;
        const idx = Math.min(days - 1, Math.max(0, Math.floor((t - from) / (24 * 60 * 60 * 1000))));
        buckets[idx] = (buckets[idx] ?? 0) + o.subtotalKobo;
      }
    }
  }

  const map = new Map<string, TopProduct>();
  for (const it of data.paidItems) {
    const paidAt = data.paidAtByOrder[it.orderId];
    if (!paidAt) continue;
    const t = new Date(paidAt).getTime();
    if (t < from || t > now) continue;
    const cur = map.get(it.name) ?? { name: it.name, qty: 0, revenueKobo: 0 };
    cur.qty += it.quantity;
    cur.revenueKobo += it.lineTotalKobo;
    map.set(it.name, cur);
  }
  const topProducts = Array.from(map.values()).sort((a, b) => b.revenueKobo - a.revenueKobo).slice(0, 5);

  return {
    paidRevenueKobo,
    paidCount,
    aovKobo: paidCount > 0 ? Math.round(paidRevenueKobo / paidCount) : 0,
    outstandingKobo,
    pendingCount,
    series: buckets,
    topProducts,
  };
}
