import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { EmptyState } from "./empty-state";
import { OrderList } from "./order-list";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const [ordersRes, productCountRes, customerCountRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, source, subtotal_kobo, created_at, customer:customers(name), order_items(id)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("business_id", business.id),
  ]);

  if (ordersRes.error) {
    console.error("[orders] fetch failed", ordersRes.error);
  }

  const rawOrders = ordersRes.data ?? [];
  const orders = rawOrders.map((o) => ({
    id: o.id as string,
    status: o.status as "pending" | "paid" | "cancelled",
    source: o.source as string,
    subtotal_kobo: o.subtotal_kobo as number,
    created_at: o.created_at as string,
    customer: Array.isArray(o.customer) ? (o.customer[0] ?? null) : (o.customer as { name: string } | null),
    item_count: Array.isArray(o.order_items) ? o.order_items.length : 0,
  }));

  const hasOrders = orders.length > 0;
  const canCreate = (productCountRes.count ?? 0) > 0 && (customerCountRes.count ?? 0) > 0;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Orders</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {hasOrders
              ? orders.length + " " + (orders.length === 1 ? "order" : "orders")
              : "Capture sales and track payments"}
          </p>
        </div>
        {hasOrders && canCreate ? (
          <Link href="/dashboard/orders/new" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-foreground/90 sm:px-5 sm:py-2.5">
            <Plus size={16} strokeWidth={2.5} />
            <span className="hidden sm:inline">Capture order</span>
            <span className="sm:hidden">New</span>
          </Link>
        ) : null}
      </header>

      {hasOrders ? <OrderList orders={orders} /> : <EmptyState canCreate={canCreate} />}
    </div>
  );
}
