"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Send } from "lucide-react";

import { buildReceiptPath, buildReceiptWhatsAppMessage } from "@/lib/receipt";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type Props = {
  orderId: string;
  receiptCode: string;
  customerName: string;
  customerPhone: string | null;
  businessName: string;
};

type ResendState = "idle" | "sending" | "sent" | "not_sent" | "error";

export function ReceiptActions(props: Props) {
  const { orderId, receiptCode, customerName, customerPhone, businessName } = props;

  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [resend, setResend] = useState<ResendState>("idle");
  const [resendNote, setResendNote] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const relativeHref = buildReceiptPath(receiptCode);
  const fullUrl = origin ? origin + relativeHref : relativeHref;
  const displayUrl = origin
    ? origin.replace("https://", "").replace("http://", "") + relativeHref
    : relativeHref;

  function copy() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(function () {
      setCopied(false);
    }, 1800);
  }

  const whatsappLink = buildWhatsAppLink(
    customerPhone,
    buildReceiptWhatsAppMessage({ businessName, customerName, receiptUrl: fullUrl }),
  );

  async function doResend() {
    setResend("sending");
    setResendNote("");
    try {
      const res = await fetch("/api/orders/resend-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResend("error");
        setResendNote(typeof data.error === "string" ? data.error : "Could not resend. Please try again.");
        return;
      }
      if (data.sent) {
        setResend("sent");
        setResendNote("Receipt sent to " + customerName + " on WhatsApp.");
      } else {
        setResend("not_sent");
        setResendNote(
          "We could not message the customer right now (their chat window may be closed). Use Copy link to send it another way.",
        );
      }
    } catch {
      setResend("error");
      setResendNote("Could not resend. Please try again.");
    }
  }

  const noteClass =
    resend === "sent"
      ? "text-brand-primary"
      : resend === "error"
        ? "text-red-300"
        : "text-white/60";

  return (
    <section className="rounded-3xl bg-foreground p-6 text-white sm:p-8">
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Share receipt</p>
        <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
          {"#" + receiptCode}
        </span>
      </div>

      <div className="mt-3">
        <code className="block truncate font-mono text-sm text-white/90 sm:text-base">{displayUrl}</code>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={doResend}
          disabled={resend === "sending"}
          className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          <Send size={14} strokeWidth={2.25} />
          <span>{resend === "sending" ? "Sending..." : "Resend to customer"}</span>
        </button>

        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15"
        >
          {copied ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={2} />}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </button>

        <a
          href={relativeHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15"
        >
          <ExternalLink size={14} strokeWidth={2} />
          <span>Open</span>
        </a>

        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15"
          >
            <MessageCircle size={14} strokeWidth={2.25} />
            <span>WhatsApp</span>
          </a>
        ) : null}
      </div>

      {resendNote ? <p className={"mt-3 text-[11px] " + noteClass}>{resendNote}</p> : null}
      {!whatsappLink ? (
        <p className="mt-3 text-[11px] text-white/50">Add a phone number to this customer to enable WhatsApp sharing.</p>
      ) : null}
    </section>
  );
}
