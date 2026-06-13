"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

import { buildReceiptPath, buildReceiptWhatsAppMessage } from "@/lib/receipt";
import { buildWhatsAppAppLink } from "@/lib/whatsapp";

type Props = {
  receiptCode: string;
  customerName: string;
  customerPhone: string | null;
  businessName: string;
};

export function ReceiptShare(props: Props) {
  const { receiptCode, customerName, customerPhone, businessName } = props;

  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const relativeHref = buildReceiptPath(receiptCode);
  const fullUrl = origin ? origin + relativeHref : relativeHref;

  let displayUrl = relativeHref;
  if (origin) {
    const host = origin.replace("https://", "").replace("http://", "");
    displayUrl = host + relativeHref;
  }

  function copy() {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(function () { setCopied(false); }, 1800);
  }

  const whatsappMessage = buildReceiptWhatsAppMessage({
    businessName,
    customerName,
    receiptUrl: fullUrl,
  });
  const whatsappLink = customerPhone ? buildWhatsAppAppLink(customerPhone, whatsappMessage) : null;

  return (
    <section className="rounded-3xl bg-foreground p-6 text-white sm:p-8">
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Receipt</p>
        <span className="rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-medium text-brand-primary">Ready to share</span>
      </div>

      <div className="mt-3">
        <code className="block truncate font-mono text-sm text-white/90 sm:text-base">{displayUrl}</code>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15">
          {copied ? <Check size={14} strokeWidth={2.25} /> : <Copy size={14} strokeWidth={2} />}
          <span>{copied ? "Copied" : "Copy link"}</span>
        </button>

        <a href={relativeHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15">
          <ExternalLink size={14} strokeWidth={2} />
          <span>Open</span>
        </a>

        {whatsappLink ? (
          <a href={whatsappLink} className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-dark">
            <MessageCircle size={14} strokeWidth={2.25} />
            <span>Send on WhatsApp</span>
          </a>
        ) : null}
      </div>

      {!whatsappLink ? (
        <p className="mt-3 text-[11px] text-white/50">Add a phone number to this customer to enable WhatsApp sharing.</p>
      ) : null}
    </section>
  );
}
