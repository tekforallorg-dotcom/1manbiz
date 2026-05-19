import Link from "next/link";
import { Package, Plus } from "lucide-react";

export function EmptyState() {
  return (
    <div className="rounded-3xl bg-white p-10 ring-1 ring-black/[0.04] sm:p-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
          <Package size={28} strokeWidth={1.75} />
        </div>

        <h2 className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">
          No products yet
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Add your first product to start tracking stock and capturing orders.
        </p>

        <Link
          href="/dashboard/inventory/new"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add product
        </Link>
      </div>
    </div>
  );
}
