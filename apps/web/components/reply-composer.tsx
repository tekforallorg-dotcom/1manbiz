"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

interface Props {
  conversationId: string;
}

export function ReplyComposer({ conversationId }: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = body.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setError(null);
    setSending(true);
    const text = body.trim();
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationId, body: text }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Send failed");
        return;
      }
      setBody("");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter sends; bare Enter inserts newline.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-black/[0.06]">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a reply..."
        rows={2}
        className="w-full resize-none border-0 bg-transparent text-sm text-foreground placeholder:text-text-muted focus:outline-none"
        disabled={sending}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted">
          {error ? <span className="text-red-600">{error}</span> : "Cmd+Enter to send"}
        </p>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={"inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
            (canSend
              ? "bg-brand-primary text-white hover:opacity-90"
              : "bg-surface-muted text-text-muted")}
        >
          <Send size={14} strokeWidth={2} />
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
