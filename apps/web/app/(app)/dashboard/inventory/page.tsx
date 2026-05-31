import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "./empty-state";
import { ProductList } from "./product-list";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
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

  const { data: products, error } = await supabase
    .from("products")
    .select(
      "id, name, sku, price_kobo, stock_quantity, image_path, status, created_at",
    )
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[inventory] fetch products failed", error);
  }

  const items = products ?? [];
  const hasItems = items.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Inventory
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasItems
              ? `${items.length} ${items.length === 1 ? "product" : "products"}`
              : "Manage what you sell"}
          </p>
        </div>
        {hasItems && (
          <Link
            href="/dashboard/inventory/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add product
          </Link>
        )}
      </header>

      {hasItems ? <ProductList products={items} /> : <EmptyState />}
    </div>
  );
}
