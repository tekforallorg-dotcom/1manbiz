import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";

export function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="rounded-3xl bg-white p-10 ring-1 ring-black/[0.04] sm:p-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
          <ShoppingBag size={28} strokeWidth={1.75} />
        </div>
        <h2 className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">No orders yet</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {canCreate
            ? "Capture your first order to start tracking sales."
            : "Add a product and a customer before capturing your first order."}
        </p>
        {canCreate ? (
          <Link href="/dashboard/orders/new" className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90">
            <Plus size={16} strokeWidth={2.5} />
            Capture order
          </Link>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Link href="/dashboard/inventory/new" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90">
              Add product
            </Link>
            <Link href="/dashboard/customers/new" className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70">
              Add customer
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
