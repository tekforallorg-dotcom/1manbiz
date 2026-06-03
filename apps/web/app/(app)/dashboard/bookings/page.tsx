import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { fetchBookings, type BookingStatus } from "@/lib/bookings";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, string> = {
    pending: "bg-warning/10 text-warning ring-warning/20",
    confirmed: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
    cancelled: "bg-text-muted/10 text-text-muted ring-text-muted/20",
    completed: "bg-foreground/10 text-foreground ring-foreground/20",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " + map[status]}>
      {label}
    </span>
  );
}

function formatWhen(startsAt: string, endsAt: string | null): { date: string; time: string } {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  const time = endsAt
    ? startTime + " - " + new Date(endsAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
    : startTime;
  return { date, time };
}

export default async function BookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const bookings = await fetchBookings(business.id, { upcomingOnly: true });
  const hasBookings = bookings.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Bookings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasBookings
              ? bookings.length + " upcoming " + (bookings.length === 1 ? "appointment" : "appointments")
              : "Schedule and track appointments"}
          </p>
        </div>
        {hasBookings ? (
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <CalendarPlus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">New booking</span>
            <span className="sm:hidden">New</span>
          </Link>
        ) : null}
      </header>

      {hasBookings ? (
        <ul className="space-y-2">
          {bookings.map((b) => {
            const customerName = b.customer?.name ?? "Unknown customer";
            return (
              <li key={b.id}>
                <Link
                  href={"/dashboard/bookings/" + b.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08] sm:gap-5 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{b.title}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{customerName}</p>
                  </div>
                  {(() => {
                    const when = formatWhen(b.starts_at, b.ends_at);
                    return (
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-foreground">{when.date}</p>
                        <p className="text-xs tabular-nums text-text-muted">{when.time}</p>
                      </div>
                    );
                  })()}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <CalendarClock size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm text-text-secondary">No upcoming bookings</p>
          <Link
            href="/dashboard/bookings/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
          >
            <CalendarPlus size={16} strokeWidth={2.25} />
            Add your first booking
          </Link>
        </div>
      )}
    </div>
  );
}
