"use client";

import { useState } from "react";

type Props = {
  slug: string;
  catalogueActive: boolean;
};

export function CatalogueLinkCard(props: Props) {
  const slug = props.slug;
  const catalogueActive = props.catalogueActive;
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = window.location.origin + "/c/" + slug;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(function () {
      setCopied(false);
    }, 1800);
  }

  const statusLabel = catalogueActive ? "Live" : "Paused";
  const statusClass = catalogueActive
    ? "rounded-full bg-brand-primary/20 px-2 py-0.5 text-[10px] font-medium text-brand-primary"
    : "rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-medium text-warning";
  const buttonText = copied ? "Copied" : "Copy link";
  const viewHref = "/c/" + slug;

  return (
    <section className="rounded-3xl bg-foreground p-6 text-white sm:p-8">
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/60">Public catalogue</p>
        <span className={statusClass}>{statusLabel}</span>
      </div>
      <div className="mt-3">
        <code className="block truncate font-mono text-sm text-white/90 sm:text-base">/c/{slug}</code>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCopy} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-white/15">{buttonText}</button>
        <a href={viewHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-primary/90">View catalogue</a>
      </div>
    </section>
  );
}