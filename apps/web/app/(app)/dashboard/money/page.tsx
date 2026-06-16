import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Clock, Receipt } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

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

function signedNaira(kobo: number): string {
  return (kobo < 0 ? "-" : "") + formatNairaFromKobo(Math.abs(kobo));
}

function MoneyKpi(props: {
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
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">
        {props.label}
      </p>
      <p
        className={
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl " +
          (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
      {props.subtitle ? (
        <p className="mt-0.5 text-xs tabular-nums text-text-muted">{props.subtitle}</p>
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

  const profitWord = profitKobo >= 0 ? "profit" : "loss";
  const outstandingSentence =
    outstandingKobo > 0
      ? " " +
        formatNairaFromKobo(outstandingKobo) +
        " is still outstanding from " +
        outstandingCount +
        (outstandingCount === 1 ? " unpaid order." : " unpaid orders.")
      : "";
  const summary = hasActivity
    ? "You made " +
      signedNaira(profitKobo) +
      " " +
      profitWord +
      " in the last " +
      period.days +
      " days." +
      outstandingSentence
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Money</h1>
          <p className="mt-1 text-sm text-text-muted">
            What came in, what went out, what you made.
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
                    ? "bg-white text-foreground shadow-sm"
                    : "text-text-secondary hover:text-foreground")
                }
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      </div>

      <section className="hm-rise">
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_50%,#064E3B_100%)] p-6 text-white shadow-[0_24px_60px_-30px_rgba(6,78,59,0.65)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-white/5 blur-3xl" />
          <div className="relative grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/65">
                Money in
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                {formatNairaFromKobo(incomeKobo)}
              </p>
              <p className="mt-0.5 text-xs text-white/70">From paid orders</p>
            </div>
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/65">
                Money out
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                {formatNairaFromKobo(expensesKobo)}
              </p>
              <p className="mt-0.5 text-xs text-white/70">Recorded expenses</p>
            </div>
            <div className="sm:border-l sm:border-white/15 sm:pl-6">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/80">
                {profitKobo >= 0 ? "Profit" : "Loss"}
              </p>
              <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
                {signedNaira(profitKobo)}
              </p>
              <p className="mt-0.5 text-xs text-white/70">Money in minus money out</p>
            </div>
          </div>
          <p className="relative mt-6 max-w-2xl border-t border-white/15 pt-4 text-sm text-white/85">
            {summary}
          </p>
        </div>
      </section>

      <section className="hm-rise grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MoneyKpi
          label="Outstanding"
          value={formatNairaFromKobo(outstandingKobo)}
          subtitle={outstandingCount + (outstandingCount === 1 ? " unpaid order" : " unpaid orders")}
          icon={<Clock className="h-5 w-5" strokeWidth={1.75} />}
          tone={outstandingKobo > 0 ? "warning" : "default"}
        />
        <MoneyKpi
          label="Receipts"
          value={String(receiptsCount)}
          subtitle={"Issued in the last " + period.days + " days"}
          icon={<Receipt className="h-5 w-5" strokeWidth={1.75} />}
        />
      </section>
    </div>
  );
}
