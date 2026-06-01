import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ProductEditForm } from "./product-edit-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, sku, description, price_kobo, stock_quantity, image_path, status",
    )
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to inventory
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Edit product
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{product.name}</p>
      </div>

      <ProductEditForm product={product} businessId={business.id} />
    </div>
  );
}
