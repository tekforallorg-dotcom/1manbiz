import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getBusinessLogoUrl } from "@/lib/storage";
import { formatNairaFromKobo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { code: string };

type ReceiptItem = {
  name: string;
  price_kobo: number;
  quantity: number;
  line_total_kobo: number;
};

type ReceiptData = {
  order: {
    receipt_code: string;
    subtotal_kobo: number;
    currency: string;
    paid_at: string;
    created_at: string;
  };
  business: {
    name: string;
    tagline: string | null;
    logo_path: string | null;
    slug: string | null;
    whatsapp_number: string | null;
  };
  customer: { name: string };
  items: ReceiptItem[];
};

async function fetchReceipt(code: string): Promise<ReceiptData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_receipt", { code_input: code });
  if (error) {
    console.error("[receipt] RPC error", error);
    return null;
  }
  return data as ReceiptData | null;
}

export async function generateMetadata(args: { params: Promise<Params> }): Promise<Metadata> {
  const { code } = await args.params;
  const data = await fetchReceipt(code);
  if (!data) {
    return { title: "Receipt not found", robots: { index: false } };
  }
  return {
    title: "Receipt from " + data.business.name,
    description: "Order receipt from " + data.business.name + " on 1Man.Biz.",
    robots: { index: false },
  };
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" });
}

export default async function ReceiptPage(args: { params: Promise<Params> }) {
  const { code } = await args.params;
  const data = await fetchReceipt(code);
  if (!data) notFound();

  const logoUrl = getBusinessLogoUrl(data.business.logo_path);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-14">
      <article className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.04]">
        <header className="flex items-center gap-4 border-b border-black/[0.04] px-6 py-6 sm:px-10 sm:py-8">
          {logoUrl ? (
            <img src={logoUrl} alt={data.business.name} className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.04]" />
          ) : (
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-lg font-semibold text-brand-primary">
              {data.business.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-foreground sm:text-xl">{data.business.name}</p>
            {data.business.tagline ? (
              <p className="mt-0.5 truncate text-sm text-text-secondary">{data.business.tagline}</p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full bg-brand-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-brand-primary ring-1 ring-brand-primary/20">
            Paid
          </span>
        </header>

        <section className="px-6 py-6 sm:px-10 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Receipt</p>
              <p className="mt-1 font-mono text-sm text-foreground">{data.order.receipt_code}</p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Paid on</p>
              <p className="mt-1 text-sm text-foreground">{formatFullDate(data.order.paid_at)}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-black/[0.04] pt-5">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Issued to</p>
            <p className="mt-1 text-base font-medium text-foreground">{data.customer.name}</p>
          </div>
        </section>

        <section className="border-t border-black/[0.04] px-6 py-6 sm:px-10 sm:py-8">
          <ul className="divide-y divide-black/[0.04]">
            {data.items.map((it, idx) => (
              <li key={idx} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{it.name}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-text-muted">
                    {it.quantity} &times; {formatNairaFromKobo(it.price_kobo)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatNairaFromKobo(it.line_total_kobo)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-black/[0.04] pt-5">
            <p className="text-sm font-medium text-text-secondary">Total paid</p>
            <p className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
              {formatNairaFromKobo(data.order.subtotal_kobo)}
            </p>
          </div>
        </section>

        <footer className="border-t border-black/[0.04] bg-surface-muted/40 px-6 py-5 text-center sm:px-10">
          <a href="https://1manbiz.vercel.app" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-muted transition-colors hover:text-text-secondary">
            Powered by <span className="font-semibold">1Man</span><span className="font-semibold text-brand-primary">.Biz</span>
          </a>
        </footer>
      </article>
    </main>
  );
}
