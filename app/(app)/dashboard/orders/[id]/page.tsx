import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";

import { OrderActionsBar } from "./order-actions-bar";

export const dynamic = "force-dynamic";

type StatusValue = "pending" | "paid" | "cancelled";

function StatusBadge({ status }: { status: StatusValue }) {
  const map = {
    pending: "bg-warning/10 text-warning ring-warning/20",
    paid: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
    cancelled: "bg-text-muted/10 text-text-muted ring-text-muted/20",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={"rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ring-1 " + map[status]}>
      {label}
    </span>
  );
}

function formatFullDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, status, source, subtotal_kobo, currency, notes, paid_at, cancelled_at, created_at, customer:customers(id, name, phone_e164), order_items(id, name_snapshot, price_kobo_snapshot, quantity, line_total_kobo)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (error) console.error("[order-detail] fetch failed", error);
  if (!order) notFound();

  const status = order.status as StatusValue;
  const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const customerName = customer?.name ?? "Unknown customer";
  const customerPhone = customer?.phone_e164 ?? null;

  const whatsappLink = customerPhone
    ? buildWhatsAppLink(customerPhone, "Hi " + customerName + ", regarding your order: ")
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          Back to orders
        </Link>
      </div>

      <header className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Order</p>
            <h1 className="mt-1 font-mono text-lg text-foreground sm:text-xl">{order.id.slice(0, 8)}</h1>
            <p className="mt-1 text-xs text-text-muted">{formatFullDate(order.created_at)}</p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="mt-6 border-t border-black/[0.04] pt-5">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Customer</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-base font-medium text-foreground">{customerName}</p>
            {customerPhone ? (
              <p className="text-sm tabular-nums text-text-muted">+{customerPhone}</p>
            ) : null}
            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-foreground/90">
                <MessageCircle size={12} strokeWidth={2.25} />
                Chat
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
        <h2 className="text-base font-medium text-foreground">Items</h2>
        <ul className="mt-4 divide-y divide-black/[0.04]">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{it.name_snapshot}</p>
                <p className="mt-0.5 text-xs tabular-nums text-text-muted">
                  {it.quantity} &times; {formatNairaFromKobo(it.price_kobo_snapshot)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatNairaFromKobo(it.line_total_kobo)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between border-t border-black/[0.04] pt-4">
          <p className="text-sm font-medium text-text-secondary">Total</p>
          <p className="text-xl font-semibold tabular-nums text-foreground">{formatNairaFromKobo(order.subtotal_kobo)}</p>
        </div>
      </section>

      {order.notes ? (
        <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
          <h2 className="text-base font-medium text-foreground">Notes</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm text-text-secondary">{order.notes}</p>
        </section>
      ) : null}

      {status === "paid" && order.paid_at ? (
        <section className="rounded-3xl bg-brand-primary/5 p-6 ring-1 ring-brand-primary/20 sm:p-8">
          <p className="text-xs uppercase tracking-[0.14em] text-brand-primary">Paid</p>
          <p className="mt-1 text-sm text-text-secondary">{formatFullDate(order.paid_at)}</p>
        </section>
      ) : null}

      {status === "cancelled" && order.cancelled_at ? (
        <section className="rounded-3xl bg-surface-muted/40 p-6 ring-1 ring-black/[0.04] sm:p-8">
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Cancelled</p>
          <p className="mt-1 text-sm text-text-secondary">{formatFullDate(order.cancelled_at)}</p>
        </section>
      ) : null}

      {status === "pending" ? (
        <OrderActionsBar orderId={order.id} />
      ) : null}
    </div>
  );
}
