import Link from "next/link";
import { redirect } from "next/navigation";
import { LineChart, TrendingUp, Package } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "all", label: "All" },
];

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  all: "all time",
};

function rangeDays(r: RangeKey): number {
  if (r === "7d") return 7;
  if (r === "30d") return 30;
  if (r === "90d") return 90;
  return 365;
}

type OrderRow = {
  id: string;
  status: string;
  subtotal_kobo: number;
  paid_at: string | null;
  created_at: string;
};
type ItemRow = {
  order_id: string;
  name_snapshot: string;
  quantity: number;
  line_total_kobo: number;
};
type TopProduct = { name: string; qty: number; revenueKobo: number };

function StatCard(props: { label: string; value: string; tone?: "default" | "brand" }) {
  const toneClass =
    props.tone === "brand"
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

function Sparkline({ series }: { series: number[] }) {
  const W = 720;
  const H = 120;
  const PAD = 8;
  const n = series.length;
  if (n === 0) return null;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => {
    const x = n === 1 ? W / 2 : PAD + (i / (n - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return { x, y };
  });
  const first = pts[0];
  const last = pts[n - 1];
  if (!first || !last) return null;
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area =
    line + " L" + last.x.toFixed(1) + " " + (H - PAD) + " L" + first.x.toFixed(1) + " " + (H - PAD) + " Z";
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="h-32 w-full text-brand-primary" preserveAspectRatio="none">
      <path d={area} fill="currentColor" fillOpacity={0.08} />
      <path
        d={line}
        stroke="currentColor"
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function buildSummary(
  paidRevenueKobo: number,
  paidCount: number,
  outstandingKobo: number,
  pendingCount: number,
  label: string,
): string {
  if (paidCount === 0 && outstandingKobo === 0) {
    return "No sales yet in this period. Share your catalogue or follow up with customers to land the first order.";
  }
  const parts: string[] = [];
  if (paidCount > 0) {
    parts.push(
      "You have collected " +
        formatNairaFromKobo(paidRevenueKobo) +
        " across " +
        paidCount +
        " paid order" +
        (paidCount === 1 ? "" : "s") +
        " in the " +
        label +
        ".",
    );
  }
  if (outstandingKobo > 0) {
    parts.push(
      formatNairaFromKobo(outstandingKobo) +
        " is still outstanding across " +
        pendingCount +
        " order" +
        (pendingCount === 1 ? "" : "s") +
        ". Your best next move is to follow them up.",
    );
  } else if (paidCount > 0) {
    parts.push("Nothing outstanding right now. You are all caught up.");
  }
  return parts.join(" ");
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: RangeKey =
    rangeParam === "30d" || rangeParam === "90d" || rangeParam === "all" ? rangeParam : "7d";

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

  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, status, subtotal_kobo, paid_at, created_at")
    .eq("business_id", business.id);

  const orders = (ordersData ?? []) as OrderRow[];
  const paidIds: string[] = [];
  const paidAtByOrder: Record<string, string | null> = {};
  for (const o of orders) {
    if (o.status === "paid") {
      paidIds.push(o.id);
      paidAtByOrder[o.id] = o.paid_at;
    }
  }

  let paidItems: ItemRow[] = [];
  if (paidIds.length > 0) {
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("order_id, name_snapshot, quantity, line_total_kobo")
      .in("order_id", paidIds);
    paidItems = (itemsData ?? []) as ItemRow[];
  }

  // Window computation mirrors the mobile insights math.
  const days = rangeDays(range);
  const now = Date.now();
  const from = now - days * 24 * 60 * 60 * 1000;

  let paidRevenueKobo = 0;
  let paidCount = 0;
  let outstandingKobo = 0;
  let pendingCount = 0;
  const buckets = new Array<number>(days).fill(0);

  for (const o of orders) {
    if (o.status === "pending") {
      outstandingKobo += o.subtotal_kobo;
      pendingCount += 1;
    }
    if (o.status === "paid" && o.paid_at) {
      const t = new Date(o.paid_at).getTime();
      if (t >= from && t <= now) {
        paidRevenueKobo += o.subtotal_kobo;
        paidCount += 1;
        const idx = Math.min(days - 1, Math.max(0, Math.floor((t - from) / (24 * 60 * 60 * 1000))));
        buckets[idx] = (buckets[idx] ?? 0) + o.subtotal_kobo;
      }
    }
  }

  const map = new Map<string, TopProduct>();
  for (const it of paidItems) {
    const paidAt = paidAtByOrder[it.order_id];
    if (!paidAt) continue;
    const t = new Date(paidAt).getTime();
    if (t < from || t > now) continue;
    const cur = map.get(it.name_snapshot) ?? { name: it.name_snapshot, qty: 0, revenueKobo: 0 };
    cur.qty += it.quantity;
    cur.revenueKobo += it.line_total_kobo;
    map.set(it.name_snapshot, cur);
  }
  const topProducts = Array.from(map.values())
    .sort((a, b) => b.revenueKobo - a.revenueKobo)
    .slice(0, 5);

  const aovKobo = paidCount > 0 ? Math.round(paidRevenueKobo / paidCount) : 0;
  const label = RANGE_LABEL[range];
  const summary = buildSummary(paidRevenueKobo, paidCount, outstandingKobo, pendingCount, label);
  const maxTop = Math.max(1, ...topProducts.map((p) => p.revenueKobo));

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Insights</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {"How " + business.name + " is performing over the " + label + "."}
          </p>
        </div>
        <nav className="inline-flex rounded-full bg-surface-muted p-1">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Link
                key={r.key}
                href={r.key === "7d" ? "/dashboard/insights" : "/dashboard/insights?range=" + r.key}
                className={
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.04]"
                    : "text-text-secondary hover:text-foreground")
                }
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Paid revenue" value={formatNairaFromKobo(paidRevenueKobo)} tone="brand" />
        <StatCard label="Paid orders" value={String(paidCount)} />
        <StatCard label="Avg order value" value={formatNairaFromKobo(aovKobo)} />
        <StatCard label="Outstanding" value={formatNairaFromKobo(outstandingKobo)} />
      </section>

      <section className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Revenue trend</p>
          <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
            <TrendingUp size={13} strokeWidth={2} />
            {label}
          </span>
        </div>
        {paidRevenueKobo > 0 ? (
          <div className="mt-4">
            <Sparkline series={buckets} />
          </div>
        ) : (
          <p className="mt-6 text-sm text-text-muted">No paid revenue in this period yet.</p>
        )}
      </section>

      <section>
        <h2 className="text-base font-medium text-foreground">Top products</h2>
        {topProducts.length === 0 ? (
          <div className="mt-4 rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
              <Package size={22} strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-sm text-text-secondary">No paid sales in this period yet</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {topProducts.map((p) => {
              const pct = Math.round((p.revenueKobo / maxTop) * 100);
              return (
                <li key={p.name} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {formatNairaFromKobo(p.revenueKobo)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-brand-primary" style={{ width: pct + "%" }} />
                    </div>
                    <p className="shrink-0 text-xs tabular-nums text-text-muted">{p.qty + " sold"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl bg-brand-soft p-5 ring-1 ring-brand-primary/10 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <LineChart size={18} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-primary">Summary</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{summary}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
