import { redirect } from "next/navigation";
import { Bot } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

import { KnowledgeManager, type KnowledgeItem } from "./knowledge-manager";
import { DeliveryZonesManager, type DeliveryZone } from "./delivery-zones-manager";
import { AiBehaviorCard } from "./ai-behavior-card";

export const dynamic = "force-dynamic";

export default async function BizBotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, ai_mode, ai_tone, ai_language, ai_sends_payment_link")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("id, title, content")
    .eq("business_id", business.id)
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const knowledge: KnowledgeItem[] = (items ?? []).map((it) => ({
    id: it.id as string,
    title: it.title as string,
    content: it.content as string,
  }));

  const { data: zoneRows } = await supabase
    .from("delivery_zones")
    .select("id, label, fee_kobo, note")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const zones: DeliveryZone[] = (zoneRows ?? []).map((z) => ({
    id: z.id as string,
    label: z.label as string,
    feeKobo: Number(z.fee_kobo ?? 0),
    note: (z.note as string | null) ?? "",
  }));

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <header className="hm-rise flex items-center gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_55%,#064E3B_100%)] text-white shadow-[0_12px_28px_-16px_rgba(6,78,59,0.6)]">
          <Bot size={20} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">BizBot</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Teach BizBot how to answer your customers. It replies automatically on WhatsApp.
          </p>
        </div>
      </header>

      <section className="hm-rise space-y-4" style={{ animationDelay: "60ms" }}>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">BizBot mode</h2>
          <p className="mt-1 text-sm text-text-secondary">
            How much BizBot does on its own, how it sounds, and the language it replies in.
          </p>
        </div>

        <AiBehaviorCard
          initialMode={(business.ai_mode as "off" | "assisted" | "semi" | "autonomous" | null) ?? "assisted"}
          initialTone={(business.ai_tone as "friendly" | "formal" | "playful" | null) ?? "friendly"}
          initialLanguage={(business.ai_language as string | null) ?? "English"}
          initialAutopay={Boolean(business.ai_sends_payment_link)}
        />
      </section>

      <section className="hm-rise space-y-4" style={{ animationDelay: "120ms" }}>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">Knowledge base</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Policies and FAQs BizBot can answer on its own - refunds, warranty, hours, payment, and more.
          </p>
        </div>

        <KnowledgeManager items={knowledge} />
      </section>

      <section className="hm-rise space-y-4" style={{ animationDelay: "180ms" }}>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">Delivery areas</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Where you deliver and what you charge. BizBot quotes these fees when customers ask.
          </p>
        </div>

        <DeliveryZonesManager zones={zones} />
      </section>
    </div>
  );
}
