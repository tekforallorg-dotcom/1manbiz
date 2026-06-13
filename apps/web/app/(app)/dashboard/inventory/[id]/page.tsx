import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ProductEditForm } from "./product-edit-form";
import { VariantEditor } from "./variant-editor";

type VariantRow = {
  id: string;
  label: string;
  price_kobo: number | null;
  stock_quantity: number;
  is_active: boolean;
};
type OptionRow = { name: string; position: number };

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

  const [optRes, varRes] = await Promise.all([
    supabase
      .from("product_options")
      .select("name, position")
      .eq("product_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, label, price_kobo, stock_quantity, is_active")
      .eq("product_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const options = (optRes.data ?? []) as OptionRow[];
  const variants = (varRes.data ?? []) as VariantRow[];
  const hasVariants = variants.length > 0;
  const axisLabel = options.map((o) => o.name).join(" / ");

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

      <ProductEditForm product={product} businessId={business.id} stockManagedByVariants={hasVariants} />

      {hasVariants ? (
        <VariantEditor
          productId={id}
          basePriceKobo={product.price_kobo}
          axisLabel={axisLabel}
          variants={variants}
        />
      ) : null}
    </div>
  );
}
