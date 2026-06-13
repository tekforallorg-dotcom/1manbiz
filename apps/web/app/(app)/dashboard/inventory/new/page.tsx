import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to inventory
        </Link>

        <div className="mt-4 flex items-center gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_55%,#064E3B_100%)] text-white shadow-[0_12px_28px_-16px_rgba(6,78,59,0.6)]">
            <Package size={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Add product</h1>
            <p className="mt-1 text-sm text-text-secondary">New item for {business.name}.</p>
          </div>
        </div>
      </div>

      <ProductForm businessId={business.id} />
    </div>
  );
}
