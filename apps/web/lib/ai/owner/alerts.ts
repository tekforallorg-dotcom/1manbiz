/**
 * Owner alerts: free-form WhatsApp pings to the shop owner's own number.
 *
 * No Meta templates. The owner admins the shop from this same chat, so the
 * 24-hour service window is normally open; if it is closed Meta rejects the
 * send and we log a warning without failing the caller. Every alert is
 * best-effort and also stored in owner_messages for continuity.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { formatNairaFromKobo } from "@/lib/format";
import { sendWhatsAppText } from "@/lib/whatsapp/send";
import { storeOwnerMessage } from "@/lib/ai/owner/owner-actions";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function notifyOwner(
  admin: AdminClient,
  businessId: string,
  body: string,
): Promise<void> {
  const { data: bizRow } = await admin
    .from("businesses")
    .select("owner_phone")
    .eq("id", businessId)
    .maybeSingle();
  const ownerPhone = ((bizRow ?? {}) as Record<string, unknown>).owner_phone as string | null;
  if (!ownerPhone) return;

  const { data: chRow } = await admin
    .from("channel_accounts")
    .select("meta_phone_number_id, access_token")
    .eq("business_id", businessId)
    .limit(1)
    .maybeSingle();
  const ch = (chRow ?? null) as { meta_phone_number_id?: string | null; access_token?: string | null } | null;
  if (!ch?.meta_phone_number_id || !ch?.access_token) return;

  const sent = await sendWhatsAppText({
    phoneNumberId: ch.meta_phone_number_id,
    accessToken: ch.access_token,
    toE164: ownerPhone,
    body,
  });
  if (!sent.ok) {
    // Most common cause: the 24h window is closed because the owner has not
    // messaged the shop recently. Logged, never fatal.
    console.warn("[owner/alerts] send failed", sent.error);
  }
  await storeOwnerMessage(admin, businessId, "out", body);
}

interface OrderForAlert {
  businessId: string;
  subtotalKobo: number;
  receiptCode: string | null;
  customerLine: string;
  lines: string[];
  productIds: string[];
  variantIds: string[];
}

async function loadOrderForAlert(admin: AdminClient, orderId: string): Promise<OrderForAlert | null> {
  const { data: orderRow } = await admin
    .from("orders")
    .select("id, business_id, subtotal_kobo, receipt_code, customer_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!orderRow) return null;
  const o = orderRow as Record<string, unknown>;

  const { data: itemRows } = await admin
    .from("order_items")
    .select("name_snapshot, variant_label_snapshot, quantity, product_id, variant_id")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  const items = (itemRows ?? []) as Array<Record<string, unknown>>;

  let customerLine = "";
  if (o.customer_id) {
    const { data: custRow } = await admin
      .from("customers")
      .select("name, phone_e164")
      .eq("id", o.customer_id as string)
      .maybeSingle();
    const c = (custRow ?? null) as { name?: string | null; phone_e164?: string | null } | null;
    if (c) customerLine = (c.name ? c.name + " " : "") + (c.phone_e164 ?? "");
  }

  return {
    businessId: o.business_id as string,
    subtotalKobo: Number(o.subtotal_kobo),
    receiptCode: (o.receipt_code as string | null) ?? null,
    customerLine,
    lines: items.map((r) => {
      const label = (r.variant_label_snapshot as string | null) ?? null;
      return (
        String(Number(r.quantity)) + "x " + (r.name_snapshot as string) + (label ? " - " + label : "")
      );
    }),
    productIds: items.map((r) => r.product_id as string | null).filter((x): x is string => !!x),
    variantIds: items.map((r) => r.variant_id as string | null).filter((x): x is string => !!x),
  };
}

// Low-stock fallout among the items just sold, against the business threshold.
async function lowStockTail(admin: AdminClient, order: OrderForAlert): Promise<string> {
  const { data: bizRow } = await admin
    .from("businesses")
    .select("low_stock_threshold")
    .eq("id", order.businessId)
    .maybeSingle();
  const threshold = Number(((bizRow ?? {}) as Record<string, unknown>).low_stock_threshold ?? 3);

  const low: string[] = [];
  if (order.productIds.length > 0) {
    const { data: prows } = await admin
      .from("products")
      .select("id, name, stock_quantity")
      .in("id", order.productIds);
    const products = (prows ?? []) as Array<Record<string, unknown>>;
    const nameById = new Map<string, string>();
    for (const p of products) nameById.set(p.id as string, p.name as string);

    if (order.variantIds.length > 0) {
      const { data: vrows } = await admin
        .from("product_variants")
        .select("id, product_id, label, stock_quantity")
        .in("id", order.variantIds);
      for (const v of (vrows ?? []) as Array<Record<string, unknown>>) {
        const stock = Number(v.stock_quantity);
        if (stock <= threshold) {
          const pname = nameById.get(v.product_id as string) ?? "";
          low.push(pname + " - " + (v.label as string) + ": " + String(stock) + " left");
        }
      }
    }
    const variantProductIds = new Set<string>();
    if (order.variantIds.length > 0) {
      // Product-level lows only for lines sold without a variant.
    }
    for (const p of products) {
      const hasVariantLine = order.variantIds.length > 0 && variantProductIds.has(p.id as string);
      if (hasVariantLine) continue;
      const stock = Number(p.stock_quantity);
      if (stock <= threshold) low.push((p.name as string) + ": " + String(stock) + " left");
    }
  }
  return low.length > 0 ? "\n\nLow stock: " + low.join("; ") : "";
}

export async function notifyOwnerOrderPaid(admin: AdminClient, orderId: string): Promise<void> {
  const order = await loadOrderForAlert(admin, orderId);
  if (!order) return;
  const tail = await lowStockTail(admin, order);
  const body =
    "Payment received: " + formatNairaFromKobo(order.subtotalKobo) + "\n" +
    order.lines.join("\n") +
    (order.customerLine ? "\nCustomer: " + order.customerLine : "") +
    (order.receiptCode ? "\nReceipt: " + order.receiptCode : "") +
    tail;
  await notifyOwner(admin, order.businessId, body);
}

export async function notifyOwnerOrderConfirmed(admin: AdminClient, orderId: string): Promise<void> {
  const order = await loadOrderForAlert(admin, orderId);
  if (!order) return;
  const body =
    "Order confirmed (awaiting payment): " + formatNairaFromKobo(order.subtotalKobo) + "\n" +
    order.lines.join("\n") +
    (order.customerLine ? "\nCustomer: " + order.customerLine : "");
  await notifyOwner(admin, order.businessId, body);
}
