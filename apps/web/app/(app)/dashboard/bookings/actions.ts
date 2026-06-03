"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type CreateBookingState = {
  status: "idle" | "error" | "success";
  error: string | null;
  fieldErrors?: Record<string, string>;
  bookingId?: string;
  conflictWarning?: string | null;
};

/**
 * Create a booking for a pending appointment.
 *
 * Customer is picked from the business's existing customers (form customer_id),
 * mirroring createOrderAction. A product/service is optional; the human-entered
 * title is the source of truth and is stored denormalized so the booking
 * survives product changes. starts_at is required; ends_at optional (all-day /
 * open-ended). Double-booking is a SOFT warning returned on success, never a
 * block -- some vendors legitimately run parallel chairs.
 */
export async function createBookingAction(
  _prev: CreateBookingState,
  formData: FormData,
): Promise<CreateBookingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Not signed in." };

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError || !business) {
    console.error("[bookings] resolve business failed", businessError);
    return { status: "error", error: "No business found for this account." };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const endsAtRaw = String(formData.get("ends_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!customerId) fieldErrors.customer_id = "Pick a customer";
  if (!title) fieldErrors.title = "Add a title";
  if (!startsAtRaw) fieldErrors.starts_at = "Pick a start time";

  let startsAtIso = "";
  let endsAtIso: string | null = null;
  if (startsAtRaw) {
    const d = new Date(startsAtRaw);
    if (Number.isNaN(d.getTime())) fieldErrors.starts_at = "Invalid start time";
    else startsAtIso = d.toISOString();
  }
  if (endsAtRaw) {
    const d = new Date(endsAtRaw);
    if (Number.isNaN(d.getTime())) fieldErrors.ends_at = "Invalid end time";
    else endsAtIso = d.toISOString();
  }
  if (startsAtIso && endsAtIso && endsAtIso <= startsAtIso) {
    fieldErrors.ends_at = "End must be after start";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", error: "Please fix the highlighted fields.", fieldErrors };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!customer) {
    return {
      status: "error",
      error: "Customer not found.",
      fieldErrors: { customer_id: "Pick a valid customer" },
    };
  }

  let productIdToInsert: string | null = null;
  if (productId) {
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (product) productIdToInsert = product.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("bookings")
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      product_id: productIdToInsert,
      title,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    console.error("[bookings] insert failed", insertError);
    return { status: "error", error: "Could not create the booking. Please retry." };
  }

  let conflictWarning: string | null = null;
  if (endsAtIso) {
    const { data: clashes } = await supabase
      .from("bookings")
      .select("id, title, starts_at")
      .eq("business_id", business.id)
      .neq("id", inserted.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAtIso)
      .gt("ends_at", startsAtIso)
      .limit(1);
    const clash = clashes?.[0];
    if (clash) {
      conflictWarning = "Heads up: this overlaps with another booking (" + clash.title + ").";
    }
  }

  revalidatePath("/dashboard/bookings");
  return {
    status: "success",
    error: null,
    bookingId: inserted.id,
    conflictWarning,
  };
}

export type BookingTransitionResult = { ok: true } | { ok: false; error: string };

type NextBookingStatus = "confirmed" | "completed" | "cancelled";

/**
 * Transition a booking's status, owner-scoped, with lifecycle guards.
 *
 * Allowed: pending -> confirmed | cancelled; confirmed -> completed | cancelled.
 * Terminal: completed and cancelled accept no further transitions. Mirrors the
 * orders transitionOrderStatus pattern (guard rules + revalidate).
 */
async function transitionBookingStatus(
  bookingId: string,
  nextStatus: NextBookingStatus,
): Promise<BookingTransitionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) return { ok: false, error: "No business" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found" };

  const current = booking.status as string;
  if (current === nextStatus) return { ok: true };

  if (current === "cancelled") {
    return { ok: false, error: "This booking was cancelled and can't be changed." };
  }
  if (current === "completed") {
    return { ok: false, error: "This booking is already completed." };
  }
  if (nextStatus === "completed" && current !== "confirmed") {
    return { ok: false, error: "Confirm the booking before marking it completed." };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: nextStatus })
    .eq("id", bookingId)
    .eq("business_id", business.id);
  if (updateError) {
    console.error("[bookings] status update failed", updateError);
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/bookings/" + bookingId);
  return { ok: true };
}

export async function confirmBookingAction(bookingId: string): Promise<BookingTransitionResult> {
  return transitionBookingStatus(bookingId, "confirmed");
}

export async function completeBookingAction(bookingId: string): Promise<BookingTransitionResult> {
  return transitionBookingStatus(bookingId, "completed");
}

export async function cancelBookingAction(bookingId: string): Promise<BookingTransitionResult> {
  return transitionBookingStatus(bookingId, "cancelled");
}
