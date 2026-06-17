import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Clock, Receipt, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";
import { MoneyFigure } from "@/components/money-figure";

import { MoneyTabs } from "./money-tabs";

export const dynamic = "force-dynamic";

/**
 * Money Overview (M3a). The ledger read: income from paid orders, outflow from
 * recorded expenses, profit as the difference, over a 7/30/90 day window.
 *
 * Income uses orders.subtotal_kobo filtered by paid_at, matching the dashboard
 * and receipts revenue convention exactly (delivery fees excluded, goods only).
 * Expenses are summed from the expenses table by occurred_at. Outstanding is
 * all-time pending (an unpaid order is owed regardless of the window). All reads
 * go through the SSR client so RLS scopes them to the signed-in owner.
 */

type Period = { key: "7d" | "30d" | "90d"; days: number; label: string };

const PERIODS: Period[] = [
  { key: "7d", days: 7, label: "7D" },
  { key: "30d", days: 30, label: "30D" },
  { key: "90d", days: 90, label: "90D" },
];

function resolvePeriod(raw: string | undefined): Period {
  if (raw === "7d") return { key: "7d", days: 7, label: "7D" };
  if (raw === "90d") return { key: "90d", days: 90, label: "90D" };
  return { key: "30d", days: 30, label: "30D" }; // default
}

function MoneyKpi(props: {
  label: string;
  value: ReactNode;
  subtitle?: string;
  icon: ReactNode;
  tone?: "default" | "warning";
}) {
  const warn = props.tone === "warning";
  return (
    <div className="group rounded-3xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover sm:p-6">
      <div
        className={
          "inline-grid size-9 place-items-center rounded-xl " +
          (warn ? "bg-warning/12 text-warning" : "bg-surface-muted text-text-secondary")
        }
      >
        {props.icon}
      </div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {props.label}
      </p>
      <p
        className={
          "mt-1.5 text-3xl " + (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
      {props.subtitle ? (
        <p className="mt-1 text-xs tabular-nums text-text-muted">{props.subtitle}</p>
      ) : null}
    </div>
  );
}

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);

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

  const now = Date.now();
  const windowStartMs = now - period.days * 24 * 60 * 60 * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const windowStartDate = windowStartIso.slice(0, 10); // YYYY-MM-DD for expenses.occurred_at

  const [incomeRes, expensesRes, outstandingRes, receiptsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("subtotal_kobo")
      .eq("business_id", business.id)
      .eq("status", "paid")
      .gte("paid_at", windowStartIso),
    supabase
      .from("expenses")
      .select("amount_kobo")
      .eq("business_id", business.id)
      .gte("occurred_at", windowStartDate),
    supabase
      .from("orders")
      .select("subtotal_kobo")
      .eq("business_id", business.id)
      .eq("status", "pending"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .eq("status", "paid")
      .not("receipt_code", "is", null)
      .gte("paid_at", windowStartIso),
  ]);

  const incomeRows = (incomeRes.data ?? []) as { subtotal_kobo: number }[];
  const expenseRows = (expensesRes.data ?? []) as { amount_kobo: number }[];
  const outstandingRows = (outstandingRes.data ?? []) as { subtotal_kobo: number }[];

  const incomeKobo = incomeRows.reduce((s, r) => s + Number(r.subtotal_kobo), 0);
  const expensesKobo = expenseRows.reduce((s, r) => s + Number(r.amount_kobo), 0);
  const profitKobo = incomeKobo - expensesKobo;
  const outstandingKobo = outstandingRows.reduce((s, r) => s + Number(r.subtotal_kobo), 0);
  const outstandingCount = outstandingRows.length;
  const receiptsCount = receiptsRes.count ?? 0;

  const hasActivity = incomeRows.length > 0 || expenseRows.length > 0;
  const isProfit = profitKobo >= 0;

  const summary = hasActivity
    ? isProfit
      ? "You are keeping " +
        formatNairaFromKobo(profitKobo) +
        " of what came in over the last " +
        period.days +
        " days."
      : "You spent " +
        formatNairaFromKobo(Math.abs(profitKobo)) +
        " more than you brought in over the last " +
        period.days +
        " days."
    : "No paid orders or expenses recorded in the last " + period.days + " days yet.";

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[1.9rem] font-semibold leading-none tracking-tight text-foreground">
            Money
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            What came in, what went out, what you kept.
          </p>
        </div>
        <div className="inline-flex rounded-full bg-surface-muted p-1">
          {PERIODS.map((p) => {
            const active = p.key === period.key;
            return (
              <Link
                key={p.key}
                href={"/dashboard/money?period=" + p.key}
                className={
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
                  (active
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-text-secondary hover:text-foreground")
                }
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <MoneyTabs active="overview" />
        <Link
          href="/dashboard/money/expenses"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Add expense
        </Link>
      </div>

      {/* Hero: profit is the thesis. The amount leads; money in / out support. */}
      <section className="hm-rise">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(150deg,#00A862_0%,#05492F_55%,#06281E_100%)] p-6 text-white shadow-[0_30px_64px_-32px_rgba(6,40,30,0.55)] sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-12 size-60 rounded-full bg-white/5 blur-3xl" />

          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {isProfit ? "Profit" : "Loss"} · last {period.days} days
            </p>
            <div className="mt-2.5">
              <MoneyFigure
                kobo={profitKobo}
                className="text-[2.85rem] leading-[0.95] sm:text-[3.6rem]"
                markClassName="opacity-70"
              />
            </div>
            {/* Signature gold ledger rule under the headline number */}
            <div className="ledger-rule mt-4 w-28 opacity-90" />

            <div className="mt-6 grid max-w-md grid-cols-2 gap-5">
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Money in
                </p>
                <p className="mt-1.5">
                  <MoneyFigure kobo={incomeKobo} className="text-xl sm:text-2xl" markClassName="opacity-60" />
                </p>
                <p className="mt-0.5 text-xs text-white/65">From paid orders</p>
              </div>
              <div className="border-l border-white/15 pl-5">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Money out
                </p>
                <p className="mt-1.5">
                  <MoneyFigure kobo={expensesKobo} className="text-xl sm:text-2xl" markClassName="opacity-60" />
                </p>
                <p className="mt-0.5 text-xs text-white/65">Recorded expenses</p>
              </div>
            </div>

            <p className="mt-6 max-w-2xl border-t border-white/15 pt-4 text-sm leading-relaxed text-white/85">
              {summary}
            </p>
          </div>
        </div>
      </section>

      <section className="hm-rise grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyKpi
          label="Outstanding"
          value={<MoneyFigure kobo={outstandingKobo} />}
          subtitle={outstandingCount + (outstandingCount === 1 ? " unpaid order" : " unpaid orders")}
          icon={<Clock className="h-5 w-5" strokeWidth={1.75} />}
          tone={outstandingKobo > 0 ? "warning" : "default"}
        />
        <MoneyKpi
          label="Receipts"
          value={<span className="money-figure">{receiptsCount}</span>}
          subtitle={"Issued in the last " + period.days + " days"}
          icon={<Receipt className="h-5 w-5" strokeWidth={1.75} />}
        />
      </section>
    </div>
  );
}
