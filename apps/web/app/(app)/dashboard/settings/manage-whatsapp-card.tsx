"use client";

import { useState } from "react";

type LinkState = {
  code: string;
  waLink: string | null;
  linkedPhone: string | null;
};

// Generate the owner-mode WhatsApp link code by calling the same endpoint mobile
// uses (POST /api/owner/link-code). On the web the call is same-origin and
// authenticates with the session cookie, so no token is needed. The owner then
// sends "LINK <code>" from their personal WhatsApp to claim the shop. The code
// is short-lived and single-use; the server is the source of truth and the
// client never invents it.
export function ManageWhatsAppCard() {
  const [link, setLink] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/link-code", { method: "POST" });
      let json:
        | {
            ok?: boolean;
            code?: string;
            expires_at?: string | null;
            already_linked?: boolean;
            linked_phone?: string | null;
            wa_number?: string | null;
            error?: string;
          }
        | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!json || !res.ok || !json.ok || !json.code) {
        setError((json && json.error) || "Could not generate a link code. Please try again.");
        setBusy(false);
        return;
      }
      const waNumber = json.wa_number ?? null;
      const waLink = waNumber
        ? "https://wa.me/" + waNumber + "?text=" + encodeURIComponent("LINK " + json.code)
        : null;
      setLink({
        code: json.code,
        waLink,
        linkedPhone: json.already_linked ? json.linked_phone ?? null : null,
      });
      setCopied(false);
    } catch {
      setError("Network error. Check your connection and try again.");
    }
    setBusy(false);
  }

  function copyCode() {
    if (!link) return;
    navigator.clipboard.writeText("LINK " + link.code);
    setCopied(true);
    setTimeout(function () {
      setCopied(false);
    }, 1800);
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <h2 className="text-base font-medium text-foreground">Manage by WhatsApp</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Run your shop from your own WhatsApp: ask for sales and stock, restock by message or photo.
        Generate a code, then send it from your personal number to your shop WhatsApp.
      </p>

      <div className="mt-5 space-y-3">
        {link?.linkedPhone ? (
          <p className="text-sm text-text-secondary">
            Linked to <span className="font-medium text-foreground">{link.linkedPhone}</span>. Generating
            a new code does not unlink; send UNLINK from that number to detach.
          </p>
        ) : null}

        {link ? (
          <div className="rounded-2xl bg-surface-muted px-4 py-3 ring-1 ring-black/[0.04]">
            <p className="text-xs text-text-muted">Send this to your shop on WhatsApp</p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-foreground">
              {"LINK " + link.code}
            </p>
            <p className="mt-2 text-xs text-text-muted">Expires in 15 minutes and works once.</p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Generating..." : link ? "Generate a new code" : "Generate link code"}
          </button>

          {link && link.waLink ? (
            <a
              href={link.waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90"
            >
              Open WhatsApp to link
            </a>
          ) : null}

          {link ? (
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted/70"
            >
              {copied ? "Copied" : "Copy code"}
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
        ) : null}
      </div>
    </section>
  );
}
