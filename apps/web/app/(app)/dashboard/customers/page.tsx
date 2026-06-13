import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Plus, Wallet, Users, Repeat } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNairaFromKobo } from "@/lib/format";

import { CustomerList } from "./customer-list";
import { EmptyState } from "./empty-state";

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
  const warn = tone === "warning";
  return (
    <div
      className={
        "rounded-3xl bg-white p-5 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.12)] sm:p-6 " +
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
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl " + (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
    </div>
  );
}

export default async function CustomersPage() {
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

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164, email, total_orders, total_spent_kobo, last_purchase_at, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[customers] fetch failed", error);
  }

  const items = customers ?? [];
  const hasItems = items.length > 0;

  const totalSpentKobo = items.reduce((sum, c) => sum + (c.total_spent_kobo as number), 0);
  const repeatCount = items.filter((c) => (c.total_orders as number) >= 2).length;

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Customers</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasItems ? items.length + " " + (items.length === 1 ? "customer" : "customers") : "Track who buys from you"}
          </p>
        </div>
        {hasItems ? (
          <Link
            href="/dashboard/customers/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white shadow-[0_10px_24px_-14px_rgba(0,0,0,0.4)] transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Add customer</span>
            <span className="sm:hidden">Add</span>
          </Link>
        ) : null}
      </header>

      {hasItems ? (
        <section className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" style={{ animationDelay: "60ms" }}>
          <StatCard
            tone="gradient"
            label="Total spent"
            value={formatNairaFromKobo(totalSpentKobo)}
            icon={<Wallet size={17} strokeWidth={1.9} />}
            className="col-span-2 sm:col-span-1"
          />
          <StatCard label="Customers" value={String(items.length)} icon={<Users size={17} strokeWidth={1.9} />} />
          <StatCard label="Repeat buyers" value={String(repeatCount)} icon={<Repeat size={17} strokeWidth={1.9} />} />
        </section>
      ) : null}

      <section className="hm-rise" style={{ animationDelay: "120ms" }}>
        {hasItems ? <CustomerList customers={items} /> : <EmptyState />}
      </section>
    </div>
  );
}
