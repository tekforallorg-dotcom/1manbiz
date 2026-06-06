/**
 * AI action: create a pending booking from a chat-confirmed time.
 *
 * The model (draft-reply) resolves the customer's words into a WAT-local
 * "YYYY-MM-DDTHH:MM"; here we validate it (parseable, in the future, within a
 * year), turn it into a real instant at +01:00 (Africa/Lagos, no DST), and
 * insert a pending booking via the service-role client. Pending, never
 * confirmed: the owner confirms from the bookings detail screen. Single-row
 * insert, so it is safe under webhook retries (the caller only runs on a fresh
 * inbound message).
 */
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface CreatePendingBookingArgs {
  admin: AdminClient;
  businessId: string;
  customerId: string;
  title: string;
  startsAtWatLocal: string; // "YYYY-MM-DDTHH:MM" in WAT (UTC+1)
}

export type CreatePendingBookingResult =
  | { ok: true; bookingId: string; startsAtIso: string }
  | { ok: false; error: string };

const WAT_OFFSET = "+01:00"; // Africa/Lagos, no daylight saving
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function createPendingBooking(
  args: CreatePendingBookingArgs,
): Promise<CreatePendingBookingResult> {
  const title = (args.title || "").trim() || "Appointment";
  const local = (args.startsAtWatLocal || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    return { ok: false, error: "unparseable start time: " + local };
  }
  const startsAt = new Date(local + ":00" + WAT_OFFSET);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, error: "invalid start time: " + local };
  }
  const now = Date.now();
  const ts = startsAt.getTime();
  if (ts <= now) return { ok: false, error: "start time is in the past" };
  if (ts > now + ONE_YEAR_MS) return { ok: false, error: "start time is too far out" };

  const startsAtIso = startsAt.toISOString();
  const { data, error } = await args.admin
    .from("bookings")
    .insert({
      business_id: args.businessId,
      customer_id: args.customerId,
      title,
      starts_at: startsAtIso,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "booking insert failed" };
  }
  return { ok: true, bookingId: data.id as string, startsAtIso };
}
