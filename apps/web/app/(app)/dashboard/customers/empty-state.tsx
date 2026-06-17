import Link from "next/link";
import { Plus, Users } from "lucide-react";

export function EmptyState() {
  return (
    <div className="rounded-3xl border border-border bg-surface p-10 shadow-card sm:p-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
          <Users size={28} strokeWidth={1.75} />
        </div>
        <h2 className="mt-6 font-display text-xl font-semibold text-foreground sm:text-2xl">
          No customers yet
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Add your first customer to start tracking who buys from you.
        </p>
        <Link
          href="/dashboard/customers/new"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add customer
        </Link>
      </div>
    </div>
  );
}
