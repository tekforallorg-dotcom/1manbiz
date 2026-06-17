"use client";

import { useEffect, useState } from "react";

import { MessageBubble } from "@/components/message-bubble";
import { createClient } from "@/lib/supabase/client";
import type { MessageRow } from "@/lib/conversations";

interface Props {
  conversationId: string;
  initialMessages: MessageRow[];
}

function mapRow(r: Record<string, unknown>): MessageRow {
  return {
    id: r.id as string,
    direction: r.direction as MessageRow["direction"],
    sender_role: r.sender_role as MessageRow["sender_role"],
    body_text: (r.body_text as string | null) ?? null,
    media_url: (r.media_url as string | null) ?? null,
    media_type: (r.media_type as string | null) ?? null,
    sent_at: r.sent_at as string,
    meta_status: (r.meta_status as string | null) ?? null,
  };
}

function upsert(list: MessageRow[], row: MessageRow): MessageRow[] {
  const idx = list.findIndex((m) => m.id === row.id);
  const next = idx === -1 ? [...list, row] : list.map((m) => (m.id === row.id ? row : m));
  return next.sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}

export function ThreadMessages({ conversationId, initialMessages }: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);

  // Reconcile when the server re-renders (composer router.refresh()).
  useEffect(() => {
    setMessages((prev) => {
      let next = prev;
      for (const m of initialMessages) next = upsert(next, m);
      return next;
    });
  }, [initialMessages]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => upsert(prev, mapRow(payload.new as Record<string, unknown>))))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => upsert(prev, mapRow(payload.new as Record<string, unknown>))))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [conversationId]);

  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-6">
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">No messages yet.</p>
      ) : (
        <ol className="space-y-3">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ol>
      )}
    </div>
  );
}
