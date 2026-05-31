import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Conversations</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Connected via WhatsApp{channel.meta_display_phone_number ? " — " + channel.meta_display_phone_number : ""}
          </p>
        </div>
      </header>

      <div className="rounded-3xl bg-white p-10 ring-1 ring-black/[0.04] sm:p-16">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand-primary">
            <MessageCircle size={28} strokeWidth={1.75} />
          </div>
          <h2 className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">Waiting for messages</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Send a test message to your WhatsApp number to see it appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
