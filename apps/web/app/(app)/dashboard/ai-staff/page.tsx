import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { KnowledgeManager, type KnowledgeItem } from "./knowledge-manager";

export const dynamic = "force-dynamic";

export default async function AiStaffPage() {
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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          AI Staff
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Teach your AI how to answer customers. It uses these answers automatically on WhatsApp.
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-text-muted">
            Knowledge base
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Policies and FAQs your AI can answer on its own &mdash; refunds, warranty, hours, payment, and more.
          </p>
        </div>

        <KnowledgeManager items={knowledge} />
      </section>
    </div>
  );
}
