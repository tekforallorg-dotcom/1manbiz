import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const [customersRes, productsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone_e164")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, price_kobo, stock_quantity")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  const customers = customersRes.data ?? [];
  const products = productsRes.data ?? [];

  if (customers.length === 0 || products.length === 0) {
    redirect("/dashboard/orders");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground">
          <ArrowLeft size={14} />
          Back to orders
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Capture order</h1>
        <p className="mt-1 text-sm text-text-secondary">{"New order for " + business.name + "."}</p>
      </div>

      <OrderForm customers={customers} products={products} />
    </div>
  );
}
