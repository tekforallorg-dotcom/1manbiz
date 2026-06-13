import { redirect } from "next/navigation";
import { Store } from "lucide-react";

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
    .select("id, name, slug, tagline, whatsapp_number, logo_path, catalogue_active, address, fulfillment_mode")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!business) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_55%,#064E3B_100%)] text-white shadow-[0_12px_28px_-16px_rgba(6,78,59,0.6)]">
          <Store size={20} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Settings</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your business profile and public catalogue.</p>
        </div>
      </header>

      <div className="hm-rise" style={{ animationDelay: "60ms" }}>
        <CatalogueLinkCard slug={business.slug} catalogueActive={business.catalogue_active} />
      </div>

      <div className="hm-rise" style={{ animationDelay: "120ms" }}>
        <BusinessSettingsForm business={business} />
      </div>

      <div className="hm-rise" style={{ animationDelay: "180ms" }}>
        <ManageWhatsAppCard />
      </div>
    </div>
  );
}
