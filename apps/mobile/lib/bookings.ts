import { supabase } from "./supabase";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface BookingListItem {
  id: string;
  title: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string | null;
  customer_name: string | null;
}

export interface BookingDetail {
  id: string;
  title: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  product_name: string | null;
}

export interface CreateBookingInput {
  businessId: string;
  customerId: string;
  title: string;
  productId?: string | null;
  startsAtIso: string;
  endsAtIso?: string | null;
  notes?: string;
}

// List bookings for a business. upcomingOnly filters to starts_at >= now and
// sorts ascending (next appointment first); otherwise newest-created first.
export async function fetchBookings(
  businessId: string,
  opts?: { upcomingOnly?: boolean; limit?: number },
): Promise<BookingListItem[]> {
  const upcomingOnly = opts?.upcomingOnly ?? true;
  const limit = opts?.limit ?? 100;

  let query = supabase
    .from("bookings")
    .select("id, title, status, starts_at, ends_at, customer:customers(name)")
    .eq("business_id", businessId);

  if (upcomingOnly) {
    query = query
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(limit);
  if (error) {
    console.error("[bookings] list failed", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      customer_name: customer?.name ?? null,
    };
  });
}

export async function fetchBookingDetail(id: string): Promise<BookingDetail | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, title, status, starts_at, ends_at, notes, customer:customers(name, phone_e164), product:products(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row: any = data;
  const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
  const product = Array.isArray(row.product) ? row.product[0] : row.product;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    notes: row.notes ?? null,
    customer_name: customer?.name ?? null,
    customer_phone: customer?.phone_e164 ?? null,
    product_name: product?.name ?? null,
  };
}

// Create a booking. Customer + product (optional) belong to the business via
// RLS; title is denormalized so the booking survives product changes. Returns
// the new id, plus an optional soft conflict warning (created either way).
export async function createBooking(
  input: CreateBookingInput,
): Promise<{ id?: string; error?: string; conflictWarning?: string | null }> {
  const title = input.title.trim();
  if (!title) return { error: "Add a title." };
  if (!input.startsAtIso) return { error: "Pick a start time." };
  if (input.endsAtIso && input.endsAtIso <= input.startsAtIso) {
    return { error: "End must be after start." };
  }

  const { data: booking, error: insertErr } = await supabase
    .from("bookings")
    .insert({
      business_id: input.businessId,
      customer_id: input.customerId,
      product_id: input.productId ?? null,
      title,
      starts_at: input.startsAtIso,
      ends_at: input.endsAtIso ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (insertErr || !booking) {
    console.error("[bookings] insert failed", insertErr);
    return { error: insertErr?.message ?? "Could not create booking." };
  }

  // Soft conflict check (timed bookings only): overlap with another active one.
  let conflictWarning: string | null = null;
  if (input.endsAtIso) {
    const { data: clashes } = await supabase
      .from("bookings")
      .select("id, title")
      .eq("business_id", input.businessId)
      .neq("id", booking.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", input.endsAtIso)
      .gt("ends_at", input.startsAtIso)
      .limit(1);
    const clash = clashes?.[0];
    if (clash) {
      conflictWarning = "Heads up: this overlaps with another booking (" + clash.title + ").";
    }
  }

  return { id: booking.id, conflictWarning };
}

type NextBookingStatus = "confirmed" | "completed" | "cancelled";

// Transition a booking's status with lifecycle guards (owner-scoped via RLS).
// pending -> confirmed | cancelled; confirmed -> completed | cancelled.
export async function transitionBooking(
  id: string,
  current: BookingStatus,
  next: NextBookingStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (current === next) return { ok: true };
  if (current === "cancelled") return { ok: false, error: "This booking was cancelled and can't be changed." };
  if (current === "completed") return { ok: false, error: "This booking is already completed." };
  if (next === "completed" && current !== "confirmed") {
    return { ok: false, error: "Confirm the booking before marking it completed." };
  }

  const { error } = await supabase.from("bookings").update({ status: next }).eq("id", id);
  if (error) {
    console.error("[bookings] status update failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
