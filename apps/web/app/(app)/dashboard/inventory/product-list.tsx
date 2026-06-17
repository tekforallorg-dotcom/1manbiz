import Link from "next/link";
import { Package } from "lucide-react";

import { formatNairaFromKobo } from "@/lib/format";
import { getProductImageUrl } from "@/lib/storage";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price_kobo: number;
  stock_quantity: number;
  image_path: string | null;
  status: string;
  created_at: string;
};

export function ProductList({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => {
        const imageUrl = getProductImageUrl(product.image_path);
        const outOfStock = product.stock_quantity === 0;
        const lowStock =
          product.stock_quantity > 0 && product.stock_quantity <= 5;
        const archived = product.status === "archived";

        return (
          <Link
            key={product.id}
            href={`/dashboard/inventory/${product.id}`}
            className={
              "group flex flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-white to-surface-muted/40 shadow-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover " +
              (archived ? "opacity-60" : "")
            }
          >
            {/* Image ? inset tile with its own gradient + rounded corners */}
            <div className="relative m-2 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-surface-muted/60 via-white to-surface-muted/30 ring-1 ring-black/[0.03]">
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="grid size-full place-items-center text-text-muted">
                  <Package size={28} strokeWidth={1.25} />
                </div>
              )}

              {archived && (
                <div className="absolute left-2 top-2">
                  <div className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-text-secondary ring-1 ring-black/[0.04] backdrop-blur-sm">
                    Archived
                  </div>
                </div>
              )}

              {(outOfStock || lowStock) && (
                <div className="absolute right-2 top-2">
                  <div
                    className={`rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium ring-1 ring-black/[0.04] backdrop-blur-sm ${
                      outOfStock ? "text-red-600" : "text-warning"
                    }`}
                  >
                    {outOfStock ? "Out of stock" : "Low stock"}
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-1">
              <h3 className="truncate text-sm font-medium text-foreground">
                {product.name}
              </h3>
              {product.sku ? (
                <p className="truncate text-[11px] text-text-muted">
                  {product.sku}
                </p>
              ) : null}
              <div className="mt-auto flex items-baseline justify-between gap-2 pt-1.5">
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {formatNairaFromKobo(product.price_kobo)}
                </p>
                {!outOfStock ? (
                  <p className="text-[11px] tabular-nums text-text-muted">
                    {product.stock_quantity} left
                  </p>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
