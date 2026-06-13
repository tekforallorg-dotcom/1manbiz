import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Receipt,
  Clock,
  Package,
  Bot,
} from "lucide-react";

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

// Monochromatic green ramp keeps the donut on-brand instead of a rainbow.
const DONUT_COLORS = ["#16A34A", "#15803D", "#22C55E", "#4ADE80", "#86EFAC"];
const OTHERS_COLOR = "#D4D4D8";

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

function HeroRevenue(props: {
  value: string;
  deltaPct: number | null;
  deltaLabel: string;
  note: string;
}) {
  const { value, deltaPct, deltaLabel, note } = props;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-primary to-brand-dark p-5 text-white shadow-[0_18px_40px_-22px_rgba(6,78,59,0.6)] sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-white/10 blur-2xl" />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Paid revenue</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{value}</p>
      {deltaPct === null ? (
        <p className="mt-2 text-xs text-white/65">{note}</p>
      ) : (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
          {deltaPct >= 0 ? (
            <ArrowUpRight size={13} strokeWidth={2.25} />
          ) : (
            <ArrowDownRight size={13} strokeWidth={2.25} />
          )}
          <span className="tabular-nums">{Math.abs(deltaPct) + "%"}</span>
          <span className="text-white/70">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}

function KpiCard(props: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "default" | "warning";
}) {
  const warn = props.tone === "warning";
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:p-6">
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
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl " +
          (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
    </div>
  );
}

function AreaTrend({ series }: { series: number[] }) {
  const W = 720;
  const H = 170;
  const PADX = 6;
  const PADT = 16;
  const PADB = 8;
  const n = series.length;
  if (n === 0) return null;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => {
    const x = n === 1 ? W / 2 : PADX + (i / (n - 1)) * (W - PADX * 2);
    const y = PADT + (1 - v / max) * (H - PADT - PADB);
    return { x, y };
  });
  const first = pts[0];
  const last = pts[n - 1];
  if (!first || !last) return null;
  const line = pts.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const area =
    line + " L" + last.x.toFixed(1) + " " + (H - PADB) + " L" + first.x.toFixed(1) + " " + (H - PADB) + " Z";
  const grid = [0.25, 0.5, 0.75].map((g) => PADT + g * (H - PADT - PADB));
  return (
    <svg viewBox={"0 0 " + W + " " + H} className="h-40 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity={0} />
        </linearGradient>
      </defs>
      {grid.map((gy, i) => (
        <line
          key={i}
          x1={0}
          y1={gy}
          x2={W}
          y2={gy}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="2 6"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill="url(#trendFill)" />
      <path
        d={line}
        stroke="var(--brand-primary)"
        strokeWidth={2.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Donut({
  segments,
  centerTop,
  centerBottom,
}: {
  segments: { label: string; value: number; color: string }[];
  centerTop: string;
  centerBottom: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 168;
  const stroke = 24;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox={"0 0 " + size + " " + size} className="h-40 w-40 shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
      <g transform={"rotate(-90 " + cx + " " + cy + ")"}>
        {total > 0
          ? segments.map((seg, i) => {
              const dash = (seg.value / total) * C;
              const node = (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={stroke}
                  strokeDasharray={dash.toFixed(2) + " " + (C - dash).toFixed(2)}
                  strokeDashoffset={(-acc).toFixed(2)}
                />
              );
              acc += dash;
              return node;
            })
          : null}
      </g>
      <text x={cx} y={cy - 1} textAnchor="middle" style={{ fill: "var(--foreground)", fontSize: "26px", fontWeight: 700 }}>
        {centerTop}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        style={{ fill: "var(--text-muted)", fontSize: "9.5px", letterSpacing: "0.14em", fontWeight: 600 }}
      >
        {centerBottom}
      </text>
    </svg>
  );
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
  const prevFrom = from - days * 24 * 60 * 60 * 1000;

  let paidRevenueKobo = 0;
  let paidCount = 0;
  let outstandingKobo = 0;
  let pendingCount = 0;
  let prevRevenueKobo = 0;
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
      } else if (t >= prevFrom && t < from) {
        prevRevenueKobo += o.subtotal_kobo;
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
  const allProducts = Array.from(map.values()).sort((a, b) => b.revenueKobo - a.revenueKobo);
  const topProducts = allProducts.slice(0, 5);
  const distinctProducts = allProducts.length;
  const totalItemsRevenue = allProducts.reduce((s, p) => s + p.revenueKobo, 0);
  const topSum = topProducts.reduce((s, p) => s + p.revenueKobo, 0);
  const othersRevenue = Math.max(0, totalItemsRevenue - topSum);

  const donutSegments = [
    ...topProducts.map((p, i) => ({
      label: p.name,
      value: p.revenueKobo,
      color: DONUT_COLORS[i] ?? OTHERS_COLOR,
    })),
    ...(othersRevenue > 0 ? [{ label: "Others", value: othersRevenue, color: OTHERS_COLOR }] : []),
  ];

  const aovKobo = paidCount > 0 ? Math.round(paidRevenueKobo / paidCount) : 0;
  const label = RANGE_LABEL[range];
  const summary = buildSummary(paidRevenueKobo, paidCount, outstandingKobo, pendingCount, label);
  const maxTop = Math.max(1, ...topProducts.map((p) => p.revenueKobo));

  const hasDelta = range !== "all" && prevRevenueKobo > 0;
  const deltaPct = hasDelta ? Math.round(((paidRevenueKobo - prevRevenueKobo) / prevRevenueKobo) * 100) : null;
  const deltaLabel = "vs previous " + label.replace("last ", "");
  const heroNote = range === "all" ? "All time total" : "In the " + label;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Insights</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {"How " + business.name + " is performing over the " + label + "."}
          </p>
        </div>
        <nav className="inline-flex rounded-full bg-surface-muted p-1 ring-1 ring-black/[0.06]">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <Link
                key={r.key}
                href={r.key === "7d" ? "/dashboard/insights" : "/dashboard/insights?range=" + r.key}
                className={
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors " +
                  (active
                    ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.06]"
                    : "text-text-secondary hover:text-foreground")
                }
              >
                {r.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="rounded-3xl bg-brand-soft p-5 ring-1 ring-brand-primary/10 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-primary/10 text-brand-primary">
            <Bot size={18} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-primary">Summary</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground sm:text-[15px]">{summary}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <HeroRevenue
          value={formatNairaFromKobo(paidRevenueKobo)}
          deltaPct={deltaPct}
          deltaLabel={deltaLabel}
          note={heroNote}
        />
        <KpiCard label="Paid orders" value={String(paidCount)} icon={<ShoppingBag size={17} strokeWidth={1.9} />} />
        <KpiCard
          label="Avg order value"
          value={formatNairaFromKobo(aovKobo)}
          icon={<Receipt size={17} strokeWidth={1.9} />}
        />
        <KpiCard
          label="Outstanding"
          value={formatNairaFromKobo(outstandingKobo)}
          icon={<Clock size={17} strokeWidth={1.9} />}
          tone={outstandingKobo > 0 ? "warning" : "default"}
        />
      </section>

      <section className="grid gap-3 sm:grid-cols-5 sm:gap-4">
        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:col-span-3 sm:p-6">
          <div className="flex items-center justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Revenue trend</p>
            <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <TrendingUp size={13} strokeWidth={2} />
              {label}
            </span>
          </div>
          {paidRevenueKobo > 0 ? (
            <div className="mt-5">
              <AreaTrend series={buckets} />
            </div>
          ) : (
            <div className="mt-5 grid h-40 place-items-center">
              <p className="text-sm text-text-muted">No paid revenue in this period yet.</p>
            </div>
          )}
        </div>

        <div className="rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] sm:col-span-2 sm:p-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Revenue by product</p>
          {totalItemsRevenue > 0 ? (
            <div className="mt-4 flex items-center gap-4">
              <Donut
                segments={donutSegments}
                centerTop={String(distinctProducts)}
                centerBottom={distinctProducts === 1 ? "PRODUCT" : "PRODUCTS"}
              />
              <ul className="min-w-0 flex-1 space-y-2">
                {donutSegments.map((s) => {
                  const pct = Math.round((s.value / totalItemsRevenue) * 100);
                  return (
                    <li key={s.label} className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">{s.label}</span>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">{pct + "%"}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="mt-4 grid h-40 place-items-center">
              <p className="text-sm text-text-muted">No product sales yet.</p>
            </div>
          )}
        </div>
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
            {topProducts.map((p, i) => {
              const pct = Math.round((p.revenueKobo / maxTop) * 100);
              return (
                <li key={p.name} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] sm:p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-muted text-[11px] font-semibold tabular-nums text-text-secondary">
                      {i + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                      {formatNairaFromKobo(p.revenueKobo)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 pl-9">
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
    </div>
  );
}
