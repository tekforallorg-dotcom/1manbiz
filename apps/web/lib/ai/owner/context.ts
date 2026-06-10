/**
 * Owner-mode grounding context.
 *
 * Builds the named blocks the management brain answers from: sales (today and
 * last 7 days, Lagos time), pending orders, recent orders, stock on hand with
 * exact counts (owner-grade; customers never see counts), low stock, best
 * sellers, and the same CATALOG block BizBot uses (shared renderer, so the
 * two brains can never disagree about the catalog). All numbers are computed
 * server-side; the model only quotes them.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { formatNairaFromKobo } from "@/lib/format";
import { buildReplyCatalog, renderCatalogBlock } from "@/lib/ai/catalog";

type AdminClient = ReturnType<typeof createAdminClient>;

// WAT is fixed UTC+1 (no DST): midnight in Lagos N days back, as ISO.
function lagosDayStartISO(daysBack: number): string {
  const wat = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(
    Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate() - daysBack, -1, 0, 0),
  ).toISOString();
}

function lagosStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function lineName(name: string, label: string | null): string {
  return label ? name + " - " + label : name;
}

export async function buildOwnerContext(admin: AdminClient, businessId: string): Promise<string> {
  const todayStart = lagosDayStartISO(0);
  const weekStart = lagosDayStartISO(6);

  const [bizRes, paidRes, pendingRes, recentRes, prodRes, varRes, soldRes, catalog] =
    await Promise.all([
      admin.from("businesses").select("low_stock_threshold").eq("id", businessId).maybeSingle(),
      admin
        .from("orders")
        .select("subtotal_kobo, paid_at")
        .eq("business_id", businessId)
        .eq("status", "paid")
        .gte("paid_at", weekStart)
        .limit(1000),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("status", "pending"),
      admin
        .from("orders")
        .select("id, status, subtotal_kobo, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(5),
      admin
        .from("products")
        .select("id, name, stock_quantity")
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(200),
      admin
        .from("product_variants")
        .select("product_id, label, stock_quantity, is_active")
        .eq("is_active", true)
        .limit(1000),
      admin
        .from("order_items")
        .select("name_snapshot, variant_label_snapshot, quantity, orders!inner(business_id, status, paid_at)")
        .eq("orders.business_id", businessId)
        .eq("orders.status", "paid")
        .gte("orders.paid_at", weekStart)
        .limit(1000),
      buildReplyCatalog(businessId),
    ]);

  const threshold = Number(
    ((bizRes.data ?? {}) as Record<string, unknown>).low_stock_threshold ?? 3,
  );

  // Sales today / last 7 days from one paid-orders fetch.
  const paid = (paidRes.data ?? []) as Array<{ subtotal_kobo: number; paid_at: string }>;
  let todayCount = 0;
  let todayKobo = 0;
  let weekCount = 0;
  let weekKobo = 0;
  for (const o of paid) {
    const k = Number(o.subtotal_kobo);
    weekCount += 1;
    weekKobo += k;
    if (o.paid_at >= todayStart) {
      todayCount += 1;
      todayKobo += k;
    }
  }

  // Recent orders with their line summaries.
  const recent = (recentRes.data ?? []) as Array<{
    id: string;
    status: string;
    subtotal_kobo: number;
    created_at: string;
  }>;
  const linesByOrder = new Map<string, string[]>();
  if (recent.length > 0) {
    const { data: itemRows } = await admin
      .from("order_items")
      .select("order_id, name_snapshot, variant_label_snapshot, quantity")
      .in("order_id", recent.map((o) => o.id));
    for (const r of (itemRows ?? []) as Array<Record<string, unknown>>) {
      const key = r.order_id as string;
      const list = linesByOrder.get(key) ?? [];
      list.push(
        String(Number(r.quantity)) +
          "x " +
          lineName(r.name_snapshot as string, (r.variant_label_snapshot as string | null) ?? null),
      );
      linesByOrder.set(key, list);
    }
  }
  const recentBlock =
    recent.length > 0
      ? recent
          .map(
            (o) =>
              "- " +
              lagosStamp(o.created_at) +
              " | " +
              o.status +
              " | " +
              formatNairaFromKobo(Number(o.subtotal_kobo)) +
              " | " +
              (linesByOrder.get(o.id) ?? []).join(", "),
          )
          .join("\n")
      : "(no orders yet)";

  // Stock on hand: exact counts, owner-grade. Variants listed under product.
  const products = (prodRes.data ?? []) as Array<{
    id: string;
    name: string;
    stock_quantity: number;
  }>;
  const productIds = new Set(products.map((p) => p.id));
  const variantsByProduct = new Map<string, Array<{ label: string; stock: number }>>();
  for (const v of (varRes.data ?? []) as Array<Record<string, unknown>>) {
    const pid = v.product_id as string;
    if (!productIds.has(pid)) continue;
    const list = variantsByProduct.get(pid) ?? [];
    list.push({ label: v.label as string, stock: Number(v.stock_quantity) });
    variantsByProduct.set(pid, list);
  }
  const stockLines: string[] = [];
  const lowLines: string[] = [];
  for (const p of products) {
    const variants = variantsByProduct.get(p.id);
    if (variants && variants.length > 0) {
      stockLines.push(
        "- " +
          p.name +
          ": " +
          String(Number(p.stock_quantity)) +
          " total (" +
          variants.map((v) => v.label + ": " + String(v.stock)).join(", ") +
          ")",
      );
      for (const v of variants) {
        if (v.stock <= threshold) lowLines.push("- " + p.name + " - " + v.label + ": " + String(v.stock) + " left");
      }
    } else {
      stockLines.push("- " + p.name + ": " + String(Number(p.stock_quantity)));
      if (Number(p.stock_quantity) <= threshold) {
        lowLines.push("- " + p.name + ": " + String(Number(p.stock_quantity)) + " left");
      }
    }
  }

  // Best sellers: paid units in the last 7 days, by product + choice.
  const soldTotals = new Map<string, number>();
  for (const r of (soldRes.data ?? []) as Array<Record<string, unknown>>) {
    const key = lineName(r.name_snapshot as string, (r.variant_label_snapshot as string | null) ?? null);
    soldTotals.set(key, (soldTotals.get(key) ?? 0) + Number(r.quantity));
  }
  const bestBlock =
    soldTotals.size > 0
      ? Array.from(soldTotals.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, n]) => "- " + k + ": " + String(n) + " sold")
          .join("\n")
      : "(no paid sales in the last 7 days)";

  return (
    "SALES TODAY: " + String(todayCount) + " paid orders, " + formatNairaFromKobo(todayKobo) + "\n" +
    "LAST 7 DAYS: " + String(weekCount) + " paid orders, " + formatNairaFromKobo(weekKobo) + "\n" +
    "PENDING ORDERS (not yet paid): " + String(pendingRes.count ?? 0) + "\n\n" +
    "RECENT ORDERS:\n" + recentBlock + "\n\n" +
    "STOCK ON HAND:\n" + (stockLines.length > 0 ? stockLines.join("\n") : "(no active products)") + "\n\n" +
    "LOW STOCK (at or below " + String(threshold) + "):\n" + (lowLines.length > 0 ? lowLines.join("\n") : "(nothing low)") + "\n\n" +
    "BEST SELLERS (last 7 days, paid):\n" + bestBlock + "\n\n" +
    "CATALOG:\n" + renderCatalogBlock(catalog)
  );
}
