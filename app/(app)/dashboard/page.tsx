import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ShoppingBag, Package, Users, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

function StatCard(props: { label: string; value: string; tone?: "default" | "brand" }) {
  const toneClass = props.tone === "brand"
    ? "bg-brand-primary text-white ring-brand-primary"
    : "bg-white text-foreground ring-black/[0.04]";
  const labelClass = props.tone === "brand" ? "text-white/70" : "text-text-muted";
  return (
    <div className={"rounded-3xl p-5 ring-1 sm:p-6 " + toneClass}>
      <p className={"text-[10.5px] font-semibold uppercase tracking-[0.14em] " + labelClass}>{props.label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{props.value}</p>
    </div>
  );
}

function todayStartUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

type StatusValue = "pending" | "paid" | "cancelled";

function StatusBadge({ status }: { status: StatusValue }) {
  const map = {
    pending: "bg-warning/10 text-warning ring-warning/20",
    paid: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
    cancelled: "bg-text-muted/10 text-text-muted ring-text-muted/20",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " + map[status]}>
      {label}
    </span>
  );
}

function formatTimeOrDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const todayIso = todayStartUtc();

  const [revenueRes, todayOrdersRes, pendingRes, productsRes, customersRes, recentRes] = await Promise.all([
    supabase
      .from("orders")
      .select("subtotal_kobo")
      .eq("business_id", business.id)
      .eq("status", "paid")
      .gte("paid_at", todayIso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", todayIso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "pending"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "active"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    supabase
      .from("orders")
      .select("id, status, subtotal_kobo, created_at, customer:customers(name)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const todayRevenueKobo = (revenueRes.data ?? []).reduce((sum, r) => sum + (r.subtotal_kobo as number), 0);
  const todayOrdersCount = todayOrdersRes.count ?? 0;
  const pendingCount = pendingRes.count ?? 0;
  const productsCount = productsRes.count ?? 0;
  const customersCount = customersRes.count ?? 0;

  const rawRecent = recentRes.data ?? [];
  const recent = rawRecent.map((o) => ({
    id: o.id as string,
    status: o.status as StatusValue,
    subtotal_kobo: o.subtotal_kobo as number,
    created_at: o.created_at as string,
    customer: Array.isArray(o.customer) ? (o.customer[0] ?? null) : (o.customer as { name: string } | null),
  }));

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "there";
  const canCaptureOrder = productsCount > 0 && customersCount > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{"Hey, " + firstName}</h1>
        <p className="mt-1 text-sm text-text-secondary">{"Here's how " + business.name + " is doing today."}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Revenue today" value={formatNairaFromKobo(todayRevenueKobo)} tone="brand" />
        <StatCard label="Orders today" value={String(todayOrdersCount)} />
        <StatCard label="Pending" value={String(pendingCount)} />
        <StatCard label="Active products" value={String(productsCount)} />
      </section>

      <section className="flex flex-wrap items-center gap-2 sm:gap-3">
        {canCaptureOrder ? (
          <Link href="/dashboard/orders/new" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90">
            <Plus size={16} strokeWidth={2.5} />
            Capture order
          </Link>
        ) : null}
        <Link href="/dashboard/inventory/new" className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
          <Package size={16} strokeWidth={2} />
          Add product
        </Link>
        <Link href="/dashboard/customers/new" className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
          <Users size={16} strokeWidth={2} />
          Add customer
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">Recent orders</h2>
          {recent.length > 0 ? (
            <Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-foreground">
              View all
              <ArrowRight size={12} strokeWidth={2} />
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <div className="mt-4 rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
              <ShoppingBag size={22} strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-sm text-text-secondary">No orders yet</p>
            {canCaptureOrder ? (
              <Link href="/dashboard/orders/new" className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90">
                Capture your first order
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {recent.map((o) => {
              const customerName = o.customer?.name ?? "Unknown customer";
              const href = "/dashboard/orders/" + o.id;
              return (
                <li key={o.id}>
                  <Link href={href} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08] sm:gap-5 sm:p-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{customerName}</p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted">{formatTimeOrDate(o.created_at)}</p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {formatNairaFromKobo(o.subtotal_kobo)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
