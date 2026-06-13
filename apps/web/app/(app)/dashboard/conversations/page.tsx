import { redirect } from "next/navigation";

import { listConversations } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

import { ConversationsLive } from "./conversations-live";
import { WhatsAppConnect } from "./whatsapp-connect";

export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!business) redirect("/onboarding");

  const { data: channel } = await supabase
    .from("channel_accounts")
    .select("id, status, meta_phone_number_id, meta_display_phone_number, last_verified_at, last_error")
    .eq("business_id", business.id)
    .eq("channel", "whatsapp")
    .neq("status", "disconnected")
    .maybeSingle();

  // Gate 1: no channel connection yet.
  if (!channel || channel.status !== "connected") {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Conversations</h1>
          <p className="mt-1 text-sm text-text-secondary">Connect WhatsApp to capture customer messages and orders.</p>
        </header>
        <WhatsAppConnect
          existingError={channel?.last_error ?? null}
          existingStatus={channel?.status ?? null}
        />
      </div>
    );
  }

  // Connected: load inbox.
  const conversations = await listConversations(supabase, business.id);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Conversations</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Connected via WhatsApp{channel.meta_display_phone_number ? " - " + channel.meta_display_phone_number : ""}
          </p>
        </div>
      </header>

      <ConversationsLive businessId={business.id} initialConversations={conversations} />
    </div>
  );
}
