import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { BookingEditForm } from "./booking-edit-form";

export const dynamic = "force-dynamic";

type Params = { id: string };

// Convert a stored UTC ISO timestamp into the value a <input type="datetime-local">
// expects: "YYYY-MM-DDTHH:MM" in LOCAL time. The server action parses it back via
// new Date(), so the round-trip preserves the wall-clock time the vendor sees.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? "0" + n : String(n));
  return (
    d.getFullYear() +
    "-" + pad(d.getMonth() + 1) +
    "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) +
    ":" + pad(d.getMinutes())
  );
}

export default async function EditBookingPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, title, status, starts_at, notes")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!booking) notFound();

  if (booking.status === "cancelled" || booking.status === "completed") {
    redirect("/dashboard/bookings/" + id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href={"/dashboard/bookings/" + id}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to booking
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Edit booking</h1>
        <p className="mt-1 text-sm text-text-secondary">Update the title, time, or notes for this appointment.</p>
      </div>

      <BookingEditForm
        bookingId={booking.id as string}
        initialTitle={booking.title as string}
        initialStartsAt={toLocalInput(booking.starts_at as string)}
        initialNotes={(booking.notes as string | null) ?? ""}
      />
    </div>
  );
}
