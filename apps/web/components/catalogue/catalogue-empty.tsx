import { Package } from "lucide-react";

export function CatalogueEmpty() {
  return (
    <div className="rounded-3xl bg-white p-12 text-center ring-1 ring-black/[0.04]">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface-muted text-text-muted">
        <Package size={24} strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-lg font-medium text-foreground">Coming soon</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Products will appear here once added.
      </p>
    </div>
  );
}
