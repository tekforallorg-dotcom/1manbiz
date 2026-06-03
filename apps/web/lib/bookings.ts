import { createClient } from "@/lib/supabase/server";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type BookingListItem = {
  id: string;
  title: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  customer: { id: string; name: string } | null;
};

/**
 * Fetch a business's bookings ordered by start time. Owner scoping is enforced
 * by RLS (bookings_select_by_owner); we still filter by business_id so the
 * query is correct even if multiple businesses ever share an owner.
 *
 * `upcomingOnly` returns bookings starting now or later (the default list view);
 * pass false to include past appointments.
 */
export async function fetchBookings(
  businessId: string,
  opts: { upcomingOnly?: boolean; limit?: number } = {},
): Promise<BookingListItem[]> {
  const { upcomingOnly = true, limit = 100 } = opts;
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select("id, title, status, starts_at, ends_at, notes, customer:customers(id, name)")
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (upcomingOnly) {
    query = query.gte("starts_at", new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[bookings] fetch failed", error);
    return [];
  }

  return (data ?? []).map((b) => ({
    id: b.id as string,
    title: b.title as string,
    status: b.status as BookingStatus,
    starts_at: b.starts_at as string,
    ends_at: (b.ends_at as string | null) ?? null,
    notes: (b.notes as string | null) ?? null,
    customer: Array.isArray(b.customer)
      ? (b.customer[0] ?? null)
      : (b.customer as { id: string; name: string } | null),
  }));
}
