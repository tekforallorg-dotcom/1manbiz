"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { ConversationRow } from "@/components/conversation-row";
import { createClient } from "@/lib/supabase/client";
import { listConversations, type ConversationListItem } from "@/lib/conversations";

interface Props {
  businessId: string;
  initialConversations: ConversationListItem[];
}

export function ConversationsLive({ businessId, initialConversations }: Props) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(initialConversations);

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    const supabase = createClient();
    const refetch = () => { void listConversations(supabase, businessId).then(setConversations); };
    const channel = supabase
      .channel(`conversations:${businessId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `business_id=eq.${businessId}` },
        refetch)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [businessId]);

  if (conversations.length === 0) {
    return (
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
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-black/[0.04]">
      <ul className="divide-y divide-border">
        {conversations.map((c) => (
          <ConversationRow key={c.id} conversation={c} />
        ))}
      </ul>
    </div>
  );
}
