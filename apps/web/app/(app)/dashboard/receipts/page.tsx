import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt, ChevronRight } from "lucide-react";

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
    .select(
      "id, subtotal_kobo, paid_at, receipt_code, customer:customers(name), order_items(name_snapshot, quantity)",
    )
    .eq("business_id", business.id)
    .eq("status", "paid")
    .not("receipt_code", "is", null)
    .order("paid_at", { ascending: false });

  if (error) {
    console.error("[receipts] fetch failed", error);
  }

  const rows = (rowsData ?? []) as unknown as ReceiptRow[];
  const totalKobo = rows.reduce((sum, r) => sum + (r.subtotal_kobo ?? 0), 0);
  const hasItems = rows.length > 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Receipts</h1>
        <p className="mt-1 text-sm text-text-secondary">Paid orders with a shareable receipt</p>
      </header>

      {!hasItems ? (
        <div className="rounded-3xl bg-white p-10 text-center ring-1 ring-black/[0.04]">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <Receipt size={22} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No receipts yet</p>
          <p className="mt-1 text-sm text-text-secondary">A receipt is created when an order is marked paid.</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-3xl bg-brand-primary p-5 text-white ring-1 ring-brand-primary sm:p-6">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">Total collected</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{formatNairaFromKobo(totalKobo)}</p>
            </div>
            <div className="rounded-3xl bg-white p-5 text-foreground ring-1 ring-black/[0.04] sm:p-6">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Receipts</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums sm:text-3xl">{String(rows.length)}</p>
            </div>
          </section>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={"/dashboard/receipts/" + r.id}
                  className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08] sm:gap-5 sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{customerName(r.customer)}</p>
                    <p className="mt-0.5 truncate text-xs text-text-muted">{itemsPreview(r.order_items)}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{formatPaidDate(r.paid_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {formatNairaFromKobo(r.subtotal_kobo)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">{"#" + r.receipt_code}</p>
                  </div>
                  <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
