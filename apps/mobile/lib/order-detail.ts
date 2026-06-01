import { supabase } from "./supabase";
import type { OrderStatus } from "./dashboard";

export type OrderSource = "manual" | "whatsapp" | "instagram" | "catalogue" | "whatsapp_ai";

export interface OrderLineItem {
  id: string;
  name_snapshot: string;
  price_kobo_snapshot: number;
  quantity: number;
  line_total_kobo: number;
}

export interface OrderDetail {
  id: string;
  business_id: string;
  source: OrderSource;
  status: OrderStatus;
  subtotal_kobo: number;
  currency: string;
  notes: string | null;
  receipt_code: string | null;
  created_at: string;
  paid_at: string | null;
  cancelled_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: OrderLineItem[];
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, business_id, source, status, subtotal_kobo, currency, notes,
      receipt_code, created_at, paid_at, cancelled_at,
      customers(name, phone_e164),
      order_items(id, name_snapshot, price_kobo_snapshot, quantity, line_total_kobo)
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[order-detail] fetch error:", error);
    return null;
  }
  if (!data) return null;

  const c = Array.isArray((data as any).customers) ? (data as any).customers[0] : (data as any).customers;

  return {
    id: data.id,
    business_id: data.business_id,
    source: data.source as OrderSource,
    status: data.status as OrderStatus,
    subtotal_kobo: data.subtotal_kobo,
    currency: data.currency,
    notes: data.notes,
    receipt_code: data.receipt_code,
    created_at: data.created_at,
    paid_at: data.paid_at,
    cancelled_at: data.cancelled_at,
    customer_name: c?.name ?? null,
    customer_phone: c?.phone_e164 ?? null,
    items: ((data as any).order_items ?? []) as OrderLineItem[],
  };
}

// Mark order as paid. The DB trigger generates receipt_code on this transition.
// Caller should refetch via fetchOrderDetail after success to get the new code.
export async function markOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) {
    console.error("[order-detail] mark paid error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
