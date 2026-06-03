import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Calendar, User, Package, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/bookings";

import { BookingActionsBar } from "./booking-actions-bar";

export const dynamic = "force-dynamic";

type Params = { id: string };

function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, string> = {
    pending: "bg-warning/10 text-warning ring-warning/20",
    confirmed: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
    cancelled: "bg-text-muted/10 text-text-muted ring-text-muted/20",
    completed: "bg-foreground/10 text-foreground ring-foreground/20",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={"rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ring-1 " + map[status]}>
      {label}
    </span>
  );
}

function formatFull(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const datePart = start.toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return datePart + " at " + startTime;
  const endTime = new Date(endsAt).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return datePart + ", " + startTime + " - " + endTime;
}

export default async function BookingDetailPage({ params }: { params: Promise<Params> }) {
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
    .select("id, title, status, starts_at, ends_at, notes, customer:customers(id, name, phone_e164), product:products(name)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!booking) notFound();

  const status = booking.status as BookingStatus;
  const customer = Array.isArray(booking.customer)
    ? (booking.customer[0] ?? null)
    : (booking.customer as { id: string; name: string; phone_e164: string | null } | null);
  const product = Array.isArray(booking.product)
    ? (booking.product[0] ?? null)
    : (booking.product as { name: string } | null);

  const isActionable = status === "pending" || status === "confirmed";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to bookings
        </Link>
      </div>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Booking</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{booking.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {isActionable ? (
              <Link
                href={"/dashboard/bookings/" + (booking.id as string) + "/edit"}
                className="text-sm font-medium text-brand-primary transition-colors hover:text-brand-dark"
              >
                Edit
              </Link>
            ) : null}
            <StatusBadge status={status} />
          </div>
        </div>

        <dl className="mt-6 space-y-4 border-t border-border pt-6">
          <div className="flex items-start gap-3">
            <Calendar size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">When</dt>
              <dd className="mt-0.5 text-sm text-foreground">{formatFull(booking.starts_at as string, (booking.ends_at as string | null) ?? null)}</dd>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Customer</dt>
              <dd className="mt-0.5 text-sm text-foreground">{customer?.name ?? "Unknown customer"}</dd>
              {customer?.phone_e164 ? (
                <dd className="text-xs tabular-nums text-text-muted">{customer.phone_e164}</dd>
              ) : null}
            </div>
          </div>

          {product?.name ? (
            <div className="flex items-start gap-3">
              <Package size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Service</dt>
                <dd className="mt-0.5 text-sm text-foreground">{product.name}</dd>
              </div>
            </div>
          ) : null}

          {booking.notes ? (
            <div className="flex items-start gap-3">
              <FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{booking.notes as string}</dd>
              </div>
            </div>
          ) : null}
        </dl>
      </section>

      {isActionable ? (
        <BookingActionsBar bookingId={booking.id as string} status={status} />
      ) : (
        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
          <p className="text-sm text-text-secondary">
            {status === "completed"
              ? "This booking is completed."
              : "This booking was cancelled."}
          </p>
        </section>
      )}
    </div>
  );
}
