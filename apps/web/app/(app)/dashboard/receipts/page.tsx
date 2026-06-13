import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Receipt, ChevronRight, Wallet, TrendingUp } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

type ReceiptItem = { name_snapshot: string | null; quantity: number | null };
type ReceiptRow = {
  id: string;
  subtotal_kobo: number;
  paid_at: string | null;
  receipt_code: string;
  customer: { name: string } | { name: string }[] | null;
  order_items: ReceiptItem[] | null;
};

function customerName(c: ReceiptRow["customer"]): string {
  if (!c) return "Customer";
  if (Array.isArray(c)) return c[0]?.name ?? "Customer";
  return c.name ?? "Customer";
}

function itemsPreview(items: ReceiptItem[] | null): string {
  if (!items || items.length === 0) return "Receipt";
  return items.map((i) => (i.quantity ?? 1) + "x " + (i.name_snapshot ?? "item")).join(", ");
}

function formatPaidDate(iso: string | null): string {
  if (!iso) return "Paid";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  );
}

function StatCard(props: { label: string; value: string; icon: ReactNode; tone?: "gradient" | "default"; className?: string }) {
  if (props.tone === "gradient") {
    return (
      <div
        className={
          "relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_55%,#064E3B_100%)] p-5 text-white shadow-[0_18px_44px_-26px_rgba(6,78,59,0.6)] sm:p-6 " +
          (props.className ?? "")
        }
      >
        <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-grid size-9 place-items-center rounded-xl bg-white/15 text-white">{props.icon}</div>
          <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{props.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{props.value}</p>
        </div>
      </div>
    );
  }
  return (
    <div
      className={
        "rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.12)] sm:p-6 " +
        (props.className ?? "")
      }
    >
      <div className="inline-grid size-9 place-items-center rounded-xl bg-surface-muted text-text-secondary">{props.icon}</div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">{props.label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{props.value}</p>
    </div>
  );
}

export default async function ReceiptsPage() {
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

  const { data: rowsData, error } = await supabase
    .from("orders")
    .select("id, subtotal_kobo, paid_at, receipt_code, customer:customers(name), order_items(name_snapshot, quantity)")
    .eq("business_id", business.id)
    .eq("status", "paid")
    .not("receipt_code", "is", null)
    .order("paid_at", { ascending: false });

  if (error) {
    console.error("[receipts] fetch failed", error);
  }

  const rows = (rowsData ?? []) as unknown as ReceiptRow[];
  const totalKobo = rows.reduce((sum, r) => sum + (r.subtotal_kobo ?? 0), 0);
  const avgKobo = rows.length ? Math.round(totalKobo / rows.length) : 0;
  const hasItems = rows.length > 0;

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Receipts</h1>
        <p className="mt-1 text-sm text-text-secondary">Paid orders with a shareable receipt</p>
      </header>

      {!hasItems ? (
        <div className="hm-rise rounded-3xl bg-white p-10 ring-1 ring-black/[0.04] sm:p-16">
          <div className="mx-auto max-w-md text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
              <Receipt size={28} strokeWidth={1.75} />
            </div>
            <h2 className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">No receipts yet</h2>
            <p className="mt-2 text-sm text-text-secondary">A receipt is created when an order is marked paid.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" style={{ animationDelay: "60ms" }}>
            <StatCard
              tone="gradient"
              label="Total collected"
              value={formatNairaFromKobo(totalKobo)}
              icon={<Wallet size={17} strokeWidth={1.9} />}
              className="col-span-2 sm:col-span-1"
            />
            <StatCard label="Receipts" value={String(rows.length)} icon={<Receipt size={17} strokeWidth={1.9} />} />
            <StatCard label="Average receipt" value={formatNairaFromKobo(avgKobo)} icon={<TrendingUp size={17} strokeWidth={1.9} />} />
          </section>

          <ul className="hm-rise space-y-2" style={{ animationDelay: "120ms" }}>
            {rows.map((r) => {
              const name = customerName(r.customer);
              const initial = name.charAt(0).toUpperCase();
              return (
                <li key={r.id}>
                  <Link
                    href={"/dashboard/receipts/" + r.id}
                    className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.12)] hover:ring-black/[0.08] sm:gap-5 sm:p-5"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-medium text-text-secondary">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{name}</p>
                      <p className="mt-0.5 truncate text-xs text-text-muted">{itemsPreview(r.order_items)}</p>
                      <p className="mt-0.5 text-xs text-text-muted">{formatPaidDate(r.paid_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums text-foreground">{formatNairaFromKobo(r.subtotal_kobo)}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-muted">{"#" + r.receipt_code}</p>
                    </div>
                    <ChevronRight
                      size={18}
                      strokeWidth={2}
                      className="hidden shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:block"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
