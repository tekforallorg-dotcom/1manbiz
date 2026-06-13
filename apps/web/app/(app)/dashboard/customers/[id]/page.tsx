import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MessageCircle, Phone, ChevronRight, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";
import { buildWhatsAppLink } from "@/lib/whatsapp";

import { EditCustomer } from "./edit-customer";

export const dynamic = "force-dynamic";

type OrderItemSnap = { name_snapshot: string | null; quantity: number | null };
type OrderRow = {
  id: string;
  subtotal_kobo: number | null;
  created_at: string;
  paid_at: string | null;
  receipt_code: string | null;
  order_items: OrderItemSnap[] | null;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return (first.charAt(0) + last.charAt(0) || "?").toUpperCase();
}

function itemSummary(items: OrderItemSnap[] | null, fallback: string): string {
  const list = items ?? [];
  const first = list[0];
  if (!first) return fallback;
  const qty = first.quantity ?? 1;
  const q = qty > 1 ? qty + "x " : "";
  let s = q + (first.name_snapshot ?? "item");
  if (list.length > 1) s += " + " + (list.length - 1) + " more";
  return s;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  );
}

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith("234") && phone.length === 13) {
    return "+234 " + phone.slice(3, 6) + " " + phone.slice(6, 9) + " " + phone.slice(9);
  }
  return phone ? "+" + phone : "";
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, name, phone_e164, email, notes, total_orders, total_spent_kobo, last_purchase_at, created_at",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!customer) {
    return (
      <div className="space-y-8">
        <div>
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Customers
          </Link>
        </div>
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <Users size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">Customer not found</p>
          <p className="mt-1 text-sm text-text-secondary">It may have been removed or you do not have access.</p>
        </div>
      </div>
    );
  }

  const [openRes, receiptRes, convoRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, subtotal_kobo, created_at, paid_at, receipt_code, order_items(name_snapshot, quantity)")
      .eq("business_id", business.id)
      .eq("customer_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, subtotal_kobo, created_at, paid_at, receipt_code, order_items(name_snapshot, quantity)")
      .eq("business_id", business.id)
      .eq("customer_id", id)
      .eq("status", "paid")
      .not("receipt_code", "is", null)
      .order("paid_at", { ascending: false }),
    supabase
      .from("conversations")
      .select("id, last_message_at")
      .eq("business_id", business.id)
      .eq("customer_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);

  const openOrders = (openRes.data ?? []) as unknown as OrderRow[];
  const receipts = (receiptRes.data ?? []) as unknown as OrderRow[];
  const convoId = ((convoRes.data ?? []) as { id: string }[])[0]?.id ?? null;

  const name = customer.name ?? "Customer";
  const phone = customer.phone_e164 ?? "";
  const email = customer.email ?? null;
  const notes = customer.notes ?? null;

  const messageHref = convoId
    ? "/dashboard/conversations/" + convoId
    : buildWhatsAppLink(phone, "Hi " + name + ", ");
  const messageExternal = !convoId;
  const callHref = phone ? "tel:+" + phone : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Customers
        </Link>
      </div>

      <section className="relative rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-base font-semibold text-brand-primary">
            {initials(name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">{name}</h1>
            {phone ? <p className="mt-0.5 text-sm tabular-nums text-text-secondary">{formatPhoneDisplay(phone)}</p> : null}
            {email ? <p className="truncate text-sm text-text-muted">{email}</p> : null}
          </div>
        </div>

        {notes ? (
          <div className="mt-4 rounded-2xl bg-surface-muted p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Notes</p>
            <p className="mt-1 text-sm text-foreground">{notes}</p>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {messageHref ? (
            <a
              href={messageHref}
              {...(messageExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
            >
              <MessageCircle size={15} strokeWidth={2.25} />
              Message
            </a>
          ) : null}
          {callHref ? (
            <a
              href={callHref}
              className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70"
            >
              <Phone size={15} strokeWidth={2} />
              Call
            </a>
          ) : null}
        </div>

        <EditCustomer customerId={customer.id} initialName={name} initialNotes={notes ?? ""} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Spent</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {formatNairaFromKobo(customer.total_spent_kobo ?? 0)}
          </p>
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Orders</p>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
            {String(customer.total_orders ?? 0)}
          </p>
        </div>
      </section>
      {customer.last_purchase_at ? (
        <p className="-mt-4 text-xs text-text-muted">{"Last purchase " + formatDate(customer.last_purchase_at)}</p>
      ) : null}

      {openOrders.length > 0 ? (
        <section>
          <h2 className="text-base font-medium text-foreground">Open orders</h2>
          <ul className="mt-3 space-y-2">
            {openOrders.map((o) => (
              <li key={o.id}>
                <Link
                  href={"/dashboard/orders/" + o.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{itemSummary(o.order_items, "Order")}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{formatDate(o.created_at)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                    {formatNairaFromKobo(o.subtotal_kobo ?? 0)}
                  </p>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-medium text-foreground">Receipts</h2>
        {receipts.length === 0 ? (
          <div className="mt-3 rounded-3xl bg-white p-6 text-center ring-1 ring-black/[0.04]">
            <p className="text-sm text-text-secondary">No paid receipts yet</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {receipts.map((r) => (
              <li key={r.id}>
                <Link
                  href={"/dashboard/receipts/" + r.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{itemSummary(r.order_items, "Receipt")}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{r.paid_at ? formatDate(r.paid_at) : "Paid"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {formatNairaFromKobo(r.subtotal_kobo ?? 0)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">{"#" + r.receipt_code}</p>
                  </div>
                  <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
