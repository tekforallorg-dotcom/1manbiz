import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { CalendarPlus, CalendarClock, CalendarCheck, Clock } from "lucide-react";

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

function StatCard(props: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "gradient" | "warning" | "default";
  className?: string;
}) {
  const tone = props.tone ?? "default";
  if (tone === "gradient") {
    return (
      <div
        className={
          "relative overflow-hidden rounded-3xl bg-[linear-gradient(150deg,#00A862_0%,#05492F_55%,#06281E_100%)] p-5 text-white shadow-[0_22px_48px_-28px_rgba(6,40,30,0.55)] sm:p-6 " +
          (props.className ?? "")
        }
      >
        <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-grid size-9 place-items-center rounded-xl bg-white/15 text-white">{props.icon}</div>
          <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{props.label}</p>
          <p className="mt-1.5 money-figure text-2xl sm:text-3xl">{props.value}</p>
        </div>
      </div>
    );
  }
  const warn = tone === "warning";
  return (
    <div
      className={
        "rounded-3xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-6 " +
        (props.className ?? "")
      }
    >
      <div
        className={
          "inline-grid size-9 place-items-center rounded-xl " +
          (warn ? "bg-warning/15 text-warning" : "bg-surface-muted text-text-secondary")
        }
      >
        {props.icon}
      </div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">{props.label}</p>
      <p
        className={
          "mt-1.5 money-figure text-2xl sm:text-3xl " + (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
    </div>
  );
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
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Bookings</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasBookings
              ? bookings.length + " upcoming " + (bookings.length === 1 ? "appointment" : "appointments")
              : "Schedule and track appointments"}
          </p>
        </div>
        {hasBookings ? (
          <Link
            href="/dashboard/bookings/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.4)] transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <CalendarPlus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">New booking</span>
            <span className="sm:hidden">New</span>
          </Link>
        ) : null}
      </header>

      {hasBookings ? (
        <>
          <section className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" style={{ animationDelay: "60ms" }}>
            <StatCard
              tone="gradient"
              label="Upcoming"
              value={String(bookings.length)}
              icon={<CalendarClock size={17} strokeWidth={1.9} />}
              className="col-span-2 sm:col-span-1"
            />
            <StatCard
              tone={pendingCount > 0 ? "warning" : "default"}
              label="Pending"
              value={String(pendingCount)}
              icon={<Clock size={17} strokeWidth={1.9} />}
            />
            <StatCard label="Confirmed" value={String(confirmedCount)} icon={<CalendarCheck size={17} strokeWidth={1.9} />} />
          </section>

          <ul className="hm-rise space-y-2" style={{ animationDelay: "120ms" }}>
            {bookings.map((b) => {
              const customerName = b.customer?.name ?? "Unknown customer";
              const start = new Date(b.starts_at);
              const tileMonth = start.toLocaleDateString("en-NG", { month: "short" }).toUpperCase();
              const tileDay = start.toLocaleDateString("en-NG", { day: "numeric" });
              const weekday = start.toLocaleDateString("en-NG", { weekday: "short" });
              const startTime = start.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
              const time = b.ends_at
                ? startTime + " - " + new Date(b.ends_at).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
                : startTime;
              return (
                <li key={b.id}>
                  <Link
                    href={"/dashboard/bookings/" + b.id}
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:gap-5 sm:p-5"
                  >
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-muted">
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-text-muted">{tileMonth}</span>
                      <span className="text-base font-semibold leading-none text-foreground tabular-nums">{tileDay}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{b.title}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{customerName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-foreground">{weekday}</p>
                      <p className="text-xs tabular-nums text-text-muted">{time}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="hm-rise rounded-3xl border border-border bg-surface p-10 shadow-card sm:p-16">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
              <CalendarClock size={28} strokeWidth={1.75} />
            </div>
            <h2 className="mt-6 font-display text-xl font-semibold text-foreground sm:text-2xl">No upcoming bookings</h2>
            <p className="mt-2 text-sm text-text-secondary">Schedule an appointment to see it here.</p>
            <Link
              href="/dashboard/bookings/new"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
            >
              <CalendarPlus size={16} strokeWidth={2.25} />
              Add your first booking
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
