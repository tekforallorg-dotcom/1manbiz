import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { BusinessSettingsForm } from "./business-settings-form";
import { CatalogueLinkCard } from "./catalogue-link-card";
import { ManageWhatsAppCard } from "./manage-whatsapp-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, tagline, whatsapp_number, logo_path, catalogue_active, address, fulfillment_mode",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your business profile and public catalogue.
        </p>
      </header>

      <CatalogueLinkCard
        slug={business.slug}
        catalogueActive={business.catalogue_active}
      />

      <BusinessSettingsForm business={business} />

      <ManageWhatsAppCard />
    </div>
  );
}
