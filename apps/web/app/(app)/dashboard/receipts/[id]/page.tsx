import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

import { ReceiptActions } from "./receipt-actions";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: string;
  name_snapshot: string | null;
  variant_label_snapshot: string | null;
  price_kobo_snapshot: number;
  quantity: number;
  line_total_kobo: number;
};

function formatPaidDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  );
}

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, status, subtotal_kobo, paid_at, receipt_code, customer:customers(name, phone_e164), order_items(id, name_snapshot, variant_label_snapshot, price_kobo_snapshot, quantity, line_total_kobo)",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!order || order.status !== "paid" || !order.receipt_code) {
    return (
      <div className="space-y-8">
        <div>
          <Link
            href="/dashboard/receipts"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} strokeWidth={2} />
            Receipts
          </Link>
        </div>
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <Receipt size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">Receipt not found</p>
          <p className="mt-1 text-sm text-text-secondary">
            It may not be paid yet, or you do not have access to it.
          </p>
        </div>
      </div>
    );
  }

  const customer = Array.isArray(order.customer)
    ? (order.customer[0] ?? null)
    : (order.customer as { name: string; phone_e164: string | null } | null);
  const customerName = customer?.name ?? "Walk-in customer";
  const customerPhone = customer?.phone_e164 ?? null;
  const items = (order.order_items ?? []) as unknown as ItemRow[];
  const receiptCode = order.receipt_code as string;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/receipts"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Receipts
        </Link>
      </div>

      <header className="space-y-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Total paid</p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-4xl font-semibold tabular-nums text-foreground">
            {formatNairaFromKobo(order.subtotal_kobo)}
          </p>
          <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary ring-1 ring-brand-primary/20">
            Paid
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Receipt</p>
          <p className="mt-1.5 font-mono text-lg font-semibold text-foreground">{"#" + receiptCode}</p>
          {order.paid_at ? <p className="mt-1 text-sm text-text-secondary">{formatPaidDate(order.paid_at)}</p> : null}
        </div>
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Customer</p>
          <p className="mt-1.5 text-lg font-semibold text-foreground">{customerName}</p>
          {customerPhone ? <p className="mt-0.5 text-sm text-text-secondary">{customerPhone}</p> : null}
        </div>
      </section>

      <section>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Items</p>
        <div className="mt-3 overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.04]">
          {items.map((it, idx) => (
            <div
              key={it.id}
              className={
                "flex items-center justify-between gap-4 px-5 py-4 " + (idx === 0 ? "" : "border-t border-border")
              }
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {(it.quantity > 1 ? it.quantity + "x " : "") + (it.name_snapshot ?? "Item")}
                </p>
                {it.variant_label_snapshot ? (
                  <p className="mt-0.5 truncate text-xs text-text-muted">{it.variant_label_snapshot}</p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatNairaFromKobo(it.line_total_kobo)}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <p className="text-sm font-semibold text-foreground">Subtotal</p>
            <p className="text-base font-semibold tabular-nums text-foreground">
              {formatNairaFromKobo(order.subtotal_kobo)}
            </p>
          </div>
        </div>
      </section>

      <ReceiptActions
        orderId={order.id}
        receiptCode={receiptCode}
        customerName={customerName}
        customerPhone={customerPhone}
        businessName={business.name}
      />
    </div>
  );
}
