import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { BookingForm } from "./booking-form";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
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

  const [customersRes, productsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name")
      .eq("business_id", business.id)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("status", "active")
      .order("name", { ascending: true }),
  ]);

  const customers = customersRes.data ?? [];
  const products = productsRes.data ?? [];

  if (customers.length === 0) {
    redirect("/dashboard/customers/new");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to bookings
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">New booking</h1>
        <p className="mt-1 text-sm text-text-secondary">{"Schedule an appointment for " + business.name + "."}</p>
      </div>

      <BookingForm customers={customers} products={products} />
    </div>
  );
}
