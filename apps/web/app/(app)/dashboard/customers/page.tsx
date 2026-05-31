import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { CustomerList } from "./customer-list";
import { EmptyState } from "./empty-state";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone_e164, email, total_orders, total_spent_kobo, last_purchase_at, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[customers] fetch failed", error);
  }

  const items = customers ?? [];
  const hasItems = items.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Customers
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasItems
              ? items.length + " " + (items.length === 1 ? "customer" : "customers")
              : "Track who buys from you"}
          </p>
        </div>
        {hasItems ? (
          <Link
            href="/dashboard/customers/new"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Add customer</span>
            <span className="sm:hidden">Add</span>
          </Link>
        ) : null}
      </header>

      {hasItems ? <CustomerList customers={items} /> : <EmptyState />}
    </div>
  );
}
