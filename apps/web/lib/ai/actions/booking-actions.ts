/**
 * Booking actions for the autonomous AI (service / hybrid businesses).
 *
 * The model (draft-reply) resolves the customer's words into a WAT-local
 * "YYYY-MM-DDTHH:MM" plus an action (create | edit | cancel). These helpers
 * validate the time, turn it into a real instant at +01:00 (Africa/Lagos, no
 * DST), and read/write bookings via the service-role client. Bookings are
 * created pending and confirmed by the owner; edit/cancel operate on the
 * customer's next upcoming booking so the AI never duplicates an appointment.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const WAT_OFFSET = "+01:00"; // Africa/Lagos, no daylight saving
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function watLocalToIso(local: string): { ok: true; iso: string } | { ok: false; error: string } {
  const t = (local || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return { ok: false, error: "unparseable start time: " + t };
  const d = new Date(t + ":00" + WAT_OFFSET);
  if (Number.isNaN(d.getTime())) return { ok: false, error: "invalid start time: " + t };
  const now = Date.now();
  const ts = d.getTime();
  if (ts <= now) return { ok: false, error: "start time is in the past" };
  if (ts > now + ONE_YEAR_MS) return { ok: false, error: "start time is too far out" };
  return { ok: true, iso: d.toISOString() };
}

export interface CurrentBooking {
  id: string;
  title: string;
  starts_at: string;
}

// The customer's next upcoming booking (pending/confirmed, soonest first), or
// null. This is the single booking that edit/cancel operate on.
export async function loadCurrentBooking(
  admin: AdminClient,
  businessId: string,
  customerId: string,
): Promise<CurrentBooking | null> {
  const { data } = await admin
    .from("bookings")
    .select("id, title, starts_at, status")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .in("status", ["pending", "confirmed"])
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, title: data.title as string, starts_at: data.starts_at as string };
}

export interface CreatePendingBookingArgs {
  admin: AdminClient;
  businessId: string;
  customerId: string;
  title: string;
  startsAtWatLocal: string;
}

export type CreatePendingBookingResult =
  | { ok: true; bookingId: string; startsAtIso: string }
  | { ok: false; error: string };

export async function createPendingBooking(
  args: CreatePendingBookingArgs,
): Promise<CreatePendingBookingResult> {
  const title = (args.title || "").trim() || "Appointment";
  const parsed = watLocalToIso(args.startsAtWatLocal);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { data, error } = await args.admin
    .from("bookings")
    .insert({
      business_id: args.businessId,
      customer_id: args.customerId,
      title,
      starts_at: parsed.iso,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "booking insert failed" };
  return { ok: true, bookingId: data.id as string, startsAtIso: parsed.iso };
}

export type EditBookingResult =
  | { ok: true; startsAtIso?: string; title?: string }
  | { ok: false; error: string };

// Edit a booking's start time and/or title via the admin client. At least one
// field must change. Caller resolves which booking (loadCurrentBooking).
export async function editBooking(
  admin: AdminClient,
  args: { bookingId: string; startsAtWatLocal?: string; title?: string },
): Promise<EditBookingResult> {
  const patch: Record<string, unknown> = {};
  let startsAtIso: string | undefined;

  if (args.startsAtWatLocal) {
    const parsed = watLocalToIso(args.startsAtWatLocal);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    startsAtIso = parsed.iso;
    patch.starts_at = parsed.iso;
  }
  const title = (args.title || "").trim();
  if (title) patch.title = title;

  if (Object.keys(patch).length === 0) return { ok: false, error: "nothing to update" };

  const { error } = await admin.from("bookings").update(patch).eq("id", args.bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, startsAtIso, title: title || undefined };
}

export async function cancelBooking(
  admin: AdminClient,
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
