import { supabase } from "./supabase";
import type { OrderStatus } from "./dashboard";
import { API_BASE_URL } from "./config";

export type OrderSource = "manual" | "whatsapp" | "instagram" | "catalogue" | "whatsapp_ai";

export interface OrderLineItem {
  id: string;
  name_snapshot: string;
  variant_label_snapshot: string | null;
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
  fulfillment_type: string | null;
  delivery_address: string | null;
  delivery_fee_kobo: number | null;
  pickup_at: string | null;
  items: OrderLineItem[];
}

export async function fetchOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, business_id, source, status, subtotal_kobo, currency, notes,
      receipt_code, created_at, paid_at, cancelled_at,
      fulfillment_type, delivery_address, delivery_fee_kobo, pickup_at,
      customers(name, phone_e164),
      order_items(id, name_snapshot, variant_label_snapshot, price_kobo_snapshot, quantity, line_total_kobo)
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
    fulfillment_type: (data as any).fulfillment_type ?? null,
    delivery_address: (data as any).delivery_address ?? null,
    delivery_fee_kobo: (data as any).delivery_fee_kobo ?? null,
    pickup_at: (data as any).pickup_at ?? null,
    customer_name: c?.name ?? null,
    customer_phone: c?.phone_e164 ?? null,
    items: ((data as any).order_items ?? []) as OrderLineItem[],
  };
}

// Mark order as paid. The DB trigger generates receipt_code on this transition.
// Caller should refetch via fetchOrderDetail after success to get the new code.
export async function markOrderPaid(orderId: string): Promise<{ ok: boolean; error?: string }> {
  // Routed through the server so the paid transition also auto-sends the
  // receipt (the mobile twin of the web Mark paid). A direct DB update from the
  // client would flip status but never run the server-side receipt send.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "You are not signed in." };

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + "/api/orders/mark-paid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }

  let json: { ok?: boolean; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Unexpected response from the server." };
  }

  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? "Could not mark the order as paid." };
  }
  return { ok: true };
}

// Cancel an order. On a paid -> cancelled transition the DB trigger restores
// stock and reverses the customer rollup (migration 0024). Routed through the
// server (mobile twin of the web cancel) so ownership is verified server-side.
// Does not refund money; refunds are handled by the vendor out-of-band.
export async function cancelOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "You are not signed in." };

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + "/api/orders/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }

  let json: { ok?: boolean; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Unexpected response from the server." };
  }

  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? "Could not cancel the order." };
  }
  return { ok: true };
}

// Resend a paid order's receipt to the customer on WhatsApp. Explicit owner
// action (force resend); the server bypasses the one-time dupe guard. Returns
// sent:false with a reason when WhatsApp delivery is not possible (e.g. the 24h
// window is closed) so the caller can suggest sharing the link instead.
export async function resendReceipt(
  orderId: string,
): Promise<{ ok: boolean; sent?: boolean; reason?: string; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "You are not signed in." };

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + "/api/orders/resend-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }

  let json: { ok?: boolean; sent?: boolean; reason?: string; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Unexpected response from the server." };
  }

  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? "Could not resend the receipt." };
  }
  return { ok: true, sent: json.sent, reason: json.reason };
}
