import { formatNairaFromKobo } from "@/lib/format";

type OrderRow = {
  id: string;
  status: "pending" | "paid" | "cancelled";
  source: string;
  subtotal_kobo: number;
  created_at: string;
  customer: { name: string } | null;
  item_count: number;
};

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  const map = {
    pending: "bg-warning/10 text-warning ring-warning/20",
    paid: "bg-brand-primary/10 text-brand-primary ring-brand-primary/20",
    cancelled: "bg-text-muted/10 text-text-muted ring-text-muted/20",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 " + map[status]}>
      {label}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

export function OrderList({ orders }: { orders: OrderRow[] }) {
  return (
    <ul className="space-y-2">
      {orders.map((o) => {
        const customerName = o.customer?.name ?? "Unknown customer";
        const itemLabel = o.item_count === 1 ? "1 item" : o.item_count + " items";
        return (
          <li key={o.id}>
            <article className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04] transition-all duration-200 hover:shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)] hover:ring-black/[0.08] sm:gap-5 sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{customerName}</p>
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-0.5 truncate text-xs text-text-muted">
                  {itemLabel} &middot; {formatDate(o.created_at)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums text-foreground">{formatNairaFromKobo(o.subtotal_kobo)}</p>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
