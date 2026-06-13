import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";
import { buildWhatsAppAppLink } from "@/lib/whatsapp";

type Customer = {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  total_orders: number;
  total_spent_kobo: number;
  last_purchase_at: string | null;
  created_at: string;
};

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith("234") && phone.length === 13) {
    return "+234 " + phone.slice(3, 6) + " " + phone.slice(6, 9) + " " + phone.slice(9);
  }
  return "+" + phone;
}

export function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <ul className="space-y-2">
      {customers.map((c) => {
        const whatsappLink = buildWhatsAppAppLink(c.phone_e164, "Hi " + c.name + ", ");
        const initial = c.name.charAt(0).toUpperCase();
        const orderLabel = c.total_orders === 0 ? "No orders yet" : c.total_orders + " order" + (c.total_orders === 1 ? "" : "s");
        return (
          <li key={c.id}>
            <article className="group flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(0,0,0,0.12)] hover:ring-black/[0.08] sm:gap-5 sm:p-5">
              <Link href={"/dashboard/customers/" + c.id} className="flex min-w-0 flex-1 items-center gap-4 sm:gap-5">
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-muted text-sm font-medium text-text-secondary sm:size-14">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{c.name}</p>
                  <p className="mt-0.5 truncate text-xs tabular-nums text-text-muted">{formatPhoneDisplay(c.phone_e164)}</p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-sm font-medium tabular-nums text-foreground">{formatNairaFromKobo(c.total_spent_kobo)}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-text-muted">{orderLabel}</p>
                </div>
              </Link>
              {whatsappLink ? (
                <a href={whatsappLink} aria-label={"Chat with " + c.name + " on WhatsApp"} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-foreground/90">
                  <MessageCircle size={12} strokeWidth={2.25} />
                  <span className="hidden sm:inline">Chat</span>
                </a>
              ) : null}
            </article>
          </li>
        );
      })}
    </ul>
  );
}
