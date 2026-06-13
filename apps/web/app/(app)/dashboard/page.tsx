import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Plus, ShoppingBag, Package, Users, ArrowRight, Clock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

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
    <span
      className={
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " + map[status]
      }
    >
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

function KpiCard(props: {
  label: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  tone?: "default" | "warning";
}) {
  const warn = props.tone === "warning";
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.12)] sm:p-6">
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
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl " + (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
      {props.subtitle ? <p className="mt-0.5 text-xs tabular-nums text-text-muted">{props.subtitle}</p> : null}
    </div>
  );
}

function HeroArea({ series }: { series: number[] }) {
  const W = 560;
  const H = 150;
  const PADT = 18;
  const n = series.length;
  if (n === 0) return null;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => {
    const x = n === 1 ? W / 2 : (i / (n - 1)) * W;
    const y = PADT + (1 - v / max) * (H - PADT);
    return { x, y };
  });
  const first = pts[0];
  const last = pts[n - 1];
  if (!first || !last) return null;
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area = line + " L" + last.x.toFixed(1) + " " + H + " L" + first.x.toFixed(1) + " " + H + " Z";
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#heroFill)" />
      <path
        d={line}
        stroke="#ffffff"
        strokeOpacity={0.95}
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

  const now = Date.now();
  const sevenFrom = now - 7 * 24 * 60 * 60 * 1000;
  const sevenFromIso = new Date(sevenFrom).toISOString();
  const todayIso = todayStartUtc();

  const [last7Res, todayOrdersRes, pendingRes, productsRes, customersRes, recentRes] = await Promise.all([
    supabase
      .from("orders")
      .select("subtotal_kobo, paid_at")
      .eq("business_id", business.id)
      .eq("status", "paid")
      .gte("paid_at", sevenFromIso),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", todayIso),
    supabase.from("orders").select("subtotal_kobo").eq("business_id", business.id).eq("status", "pending"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    supabase
      .from("orders")
      .select("id, status, subtotal_kobo, created_at, customer:customers(name)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const last7 = (last7Res.data ?? []) as { subtotal_kobo: number; paid_at: string | null }[];
  const buckets7 = new Array<number>(7).fill(0);
  const todayTs = new Date(todayIso).getTime();
  let todayRevenueKobo = 0;
  for (const r of last7) {
    if (!r.paid_at) continue;
    const t = new Date(r.paid_at).getTime();
    if (t >= sevenFrom && t <= now) {
      const idx = Math.min(6, Math.max(0, Math.floor((t - sevenFrom) / (24 * 60 * 60 * 1000))));
      buckets7[idx] = (buckets7[idx] ?? 0) + r.subtotal_kobo;
    }
    if (t >= todayTs) todayRevenueKobo += r.subtotal_kobo;
  }
  const hasTrend = buckets7.some((b) => b > 0);

  const pendingRows = (pendingRes.data ?? []) as { subtotal_kobo: number }[];
  const pendingCount = pendingRows.length;
  const pendingOutstandingKobo = pendingRows.reduce((s, r) => s + r.subtotal_kobo, 0);

  const todayOrdersCount = todayOrdersRes.count ?? 0;
  const productsCount = productsRes.count ?? 0;
  const customersCount = customersRes.count ?? 0;

  const rawRecent = recentRes.data ?? [];
  const recent = rawRecent.map((o) => ({
    id: o.id as string,
    status: o.status as StatusValue,
    subtotal_kobo: o.subtotal_kobo as number,
    created_at: o.created_at as string,
    customer: Array.isArray(o.customer)
      ? (o.customer[0] ?? null)
      : (o.customer as { name: string } | null),
  }));

  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : "there";
  const dateLabel = new Date().toLocaleDateString("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const canCaptureOrder = productsCount > 0 && customersCount > 0;

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <section className="hm-rise">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_50%,#064E3B_100%)] p-6 text-white shadow-[0_24px_60px_-30px_rgba(6,78,59,0.65)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-white/80">
                <span className="font-medium text-white">{"Hey, " + firstName}</span>
                <span className="text-white/40">&middot;</span>
                <span>{dateLabel}</span>
              </div>
              <p className="mt-5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/65">Revenue today</p>
              <p className="mt-1.5 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                {formatNairaFromKobo(todayRevenueKobo)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
                <span>{todayOrdersCount + " order" + (todayOrdersCount === 1 ? "" : "s") + " today"}</span>
                <Link
                  href="/dashboard/insights"
                  className="inline-flex items-center gap-1 font-medium text-white/90 underline-offset-4 transition-colors hover:text-white hover:underline"
                >
                  View insights
                  <ArrowRight size={13} strokeWidth={2.25} />
                </Link>
              </div>
            </div>
            {hasTrend ? (
              <div className="-mb-6 -mr-6 h-24 w-full sm:-mb-8 sm:-mr-8 sm:h-36 sm:max-w-[56%]">
                <HeroArea series={buckets7} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        style={{ animationDelay: "60ms" }}
      >
        <KpiCard
          label="Orders today"
          value={String(todayOrdersCount)}
          icon={<ShoppingBag size={17} strokeWidth={1.9} />}
        />
        <KpiCard
          label="Pending"
          value={String(pendingCount)}
          subtitle={pendingCount > 0 ? formatNairaFromKobo(pendingOutstandingKobo) + " owed" : "All settled"}
          icon={<Clock size={17} strokeWidth={1.9} />}
          tone={pendingCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Active products"
          value={String(productsCount)}
          icon={<Package size={17} strokeWidth={1.9} />}
        />
        <KpiCard label="Customers" value={String(customersCount)} icon={<Users size={17} strokeWidth={1.9} />} />
      </section>

      <section className="hm-rise flex flex-wrap items-center gap-2 sm:gap-3" style={{ animationDelay: "120ms" }}>
        {canCaptureOrder ? (
          <Link
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.4)] transition-colors hover:bg-foreground/90"
          >
            <Plus size={16} strokeWidth={2.5} />
            Capture order
          </Link>
        ) : null}
        <Link
          href="/dashboard/inventory/new"
          className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70"
        >
          <Package size={16} strokeWidth={2} />
          Add product
        </Link>
        <Link
          href="/dashboard/customers/new"
          className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70"
        >
          <Users size={16} strokeWidth={2} />
          Add customer
        </Link>
      </section>

      <section className="hm-rise" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">Recent orders</h2>
          {recent.length > 0 ? (
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary transition-colors hover:text-foreground"
            >
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
              <Link
                href="/dashboard/orders/new"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
              >
                Capture your first order
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {recent.map((o) => {
              const customerName = o.customer?.name ?? "Unknown customer";
              const initial = customerName.charAt(0).toUpperCase();
              const href = "/dashboard/orders/" + o.id;
              return (
                <li key={o.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.12)] hover:ring-black/[0.08] sm:gap-5 sm:p-5"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-medium text-text-secondary">
                      {initial}
                    </div>
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
