"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MessageCircle, MessageSquare, Mail, Inbox, Search } from "lucide-react";

import { ConversationRow } from "@/components/conversation-row";
import { createClient } from "@/lib/supabase/client";
import { listConversations, type ConversationListItem } from "@/lib/conversations";

interface Props {
  businessId: string;
  initialConversations: ConversationListItem[];
}

type FilterKey = "all" | "unread" | "open" | "closed";

function StatCard(props: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "gradient" | "warning" | "default";
  className?: string;
}) {
  const tone = props.tone ?? "default";
  if (tone === "gradient") {
    return (
      <div
        className={
          "relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#16A34A_0%,#15803D_55%,#064E3B_100%)] p-5 text-white shadow-[0_18px_44px_-26px_rgba(6,78,59,0.6)] sm:p-6 " +
          (props.className ?? "")
        }
      >
        <div className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="inline-grid size-9 place-items-center rounded-xl bg-white/15 text-white">{props.icon}</div>
          <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/70">{props.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">{props.value}</p>
        </div>
      </div>
    );
  }
  const warn = tone === "warning";
  return (
    <div
      className={
        "rounded-3xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(0,0,0,0.12)] sm:p-6 " +
        (props.className ?? "")
      }
    >
      <div
        className={
          "inline-grid size-9 place-items-center rounded-xl " +
          (warn ? "bg-warning/15 text-warning" : "bg-surface-muted text-text-secondary")
        }
      >
        {props.icon}
      </div>
      <p className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">{props.label}</p>
      <p
        className={
          "mt-1 text-2xl font-semibold tabular-nums sm:text-3xl " + (warn ? "text-warning" : "text-foreground")
        }
      >
        {props.value}
      </p>
    </div>
  );
}

export function ConversationsLive({ businessId, initialConversations }: Props) {
  const [conversations, setConversations] = useState<ConversationListItem[]>(initialConversations);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  useEffect(() => {
    const supabase = createClient();
    const refetch = () => {
      void listConversations(supabase, businessId).then(setConversations);
    };
    const channel = supabase
      .channel(`conversations:${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `business_id=eq.${businessId}` },
        refetch,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => c.unread_count > 0).length,
      open: conversations.filter((c) => c.status === "open").length,
      closed: conversations.filter((c) => c.status === "closed").length,
    }),
    [conversations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (filter === "open" && c.status !== "open") return false;
      if (filter === "closed" && c.status !== "closed") return false;
      if (!q) return true;
      const name = (c.customer_name ?? "").toLowerCase();
      const phone = (c.contact_phone_e164 ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [conversations, query, filter]);

  // No conversations at all.
  if (conversations.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-10 shadow-card sm:p-16">
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

  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "open", label: "Open", count: counts.open },
    { key: "closed", label: "Closed", count: counts.closed },
  ];

  return (
    <div className="space-y-6">
      <style>{`
@keyframes hmRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.hm-rise { animation: hmRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .hm-rise { animation: none; } }
`}</style>

      <section className="hm-rise grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          tone="gradient"
          label="Conversations"
          value={String(counts.all)}
          icon={<MessageSquare size={17} strokeWidth={1.9} />}
          className="col-span-2 sm:col-span-1"
        />
        <StatCard
          tone={counts.unread > 0 ? "warning" : "default"}
          label="Unread"
          value={String(counts.unread)}
          icon={<Mail size={17} strokeWidth={1.9} />}
        />
        <StatCard label="Open" value={String(counts.open)} icon={<Inbox size={17} strokeWidth={1.9} />} />
      </section>

      <div className="hm-rise flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: "60ms" }}>
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone"
            aria-label="Search conversations"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-text-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-surface-muted p-1">
            {tabs.map((t) => {
              const active = filter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFilter(t.key)}
                  className={
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
                    (active ? "bg-white text-foreground shadow-sm ring-1 ring-black/[0.05]" : "text-text-secondary hover:text-foreground")
                  }
                >
                  <span>{t.label}</span>
                  <span className="tabular-nums text-text-muted">{t.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="hm-rise rounded-3xl border border-border bg-surface p-10 text-center shadow-card" style={{ animationDelay: "120ms" }}>
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-muted text-text-muted">
            <Search size={20} strokeWidth={1.75} />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">No matches</p>
          <p className="mt-1 text-sm text-text-secondary">No conversations match your search or filter.</p>
        </div>
      ) : (
        <div className="hm-rise overflow-hidden rounded-3xl border border-border bg-surface shadow-card" style={{ animationDelay: "120ms" }}>
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
