import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Plus, Wallet, Clock, ShoppingBag } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

import { EmptyState } from "./empty-state";
import { OrderList } from "./order-list";

export const dynamic = "force-dynamic";

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

export default async function OrdersPage() {
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

  const [listRes, paidRes, pendingRes, cancelledCountRes, productCountRes, customerCountRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, source, subtotal_kobo, created_at, customer:customers(name), order_items(id)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("orders").select("subtotal_kobo").eq("business_id", business.id).eq("status", "paid"),
    supabase.from("orders").select("subtotal_kobo").eq("business_id", business.id).eq("status", "pending"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "cancelled"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id),
  ]);

  if (listRes.error) {
    console.error("[orders] fetch failed", listRes.error);
  }

  const rawOrders = listRes.data ?? [];
  const orders = rawOrders.map((o) => ({
    id: o.id as string,
    status: o.status as "pending" | "paid" | "cancelled",
    source: o.source as string,
    subtotal_kobo: o.subtotal_kobo as number,
    created_at: o.created_at as string,
    customer: Array.isArray(o.customer) ? (o.customer[0] ?? null) : (o.customer as { name: string } | null),
    item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }));

  const paidRows = (paidRes.data ?? []) as { subtotal_kobo: number }[];
  const pendingRows = (pendingRes.data ?? []) as { subtotal_kobo: number }[];
  const collectedKobo = paidRows.reduce((s, r) => s + r.subtotal_kobo, 0);
  const outstandingKobo = pendingRows.reduce((s, r) => s + r.subtotal_kobo, 0);
  const cancelledCount = cancelledCountRes.count ?? 0;
  const totalCount = paidRows.length + pendingRows.length + cancelledCount;

  const hasOrders = orders.length > 0;
  const canCreate = (productCountRes.count ?? 0) > 0 && (customerCountRes.count ?? 0) > 0;

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Orders</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasOrders
              ? totalCount + " " + (totalCount === 1 ? "order" : "orders")
              : "Capture sales and track payments"}
          </p>
        </div>
        {hasOrders && canCreate ? (
          <Link
            href="/dashboard/orders/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.4)] transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Capture order</span>
            <span className="sm:hidden">New</span>
          </Link>
        ) : null}
      </header>

      {hasOrders ? (
        <section className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" style={{ animationDelay: "60ms" }}>
          <StatCard
            tone="gradient"
            label="Collected"
            value={formatNairaFromKobo(collectedKobo)}
            icon={<Wallet size={17} strokeWidth={1.9} />}
            className="col-span-2 sm:col-span-1"
          />
          <StatCard
            tone={outstandingKobo > 0 ? "warning" : "default"}
            label="Outstanding"
            value={formatNairaFromKobo(outstandingKobo)}
            icon={<Clock size={17} strokeWidth={1.9} />}
          />
          <StatCard label="Orders" value={String(totalCount)} icon={<ShoppingBag size={17} strokeWidth={1.9} />} />
        </section>
      ) : null}

      <section className="hm-rise" style={{ animationDelay: "120ms" }}>
        {hasOrders ? <OrderList orders={orders} /> : <EmptyState canCreate={canCreate} />}
      </section>
    </div>
  );
}
