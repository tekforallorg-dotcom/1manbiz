"use client";

import { useState, useTransition } from "react";

import { updateAiBehaviorAction } from "./actions";

type AiMode = "off" | "assisted" | "semi" | "autonomous";
type AiTone = "friendly" | "formal" | "playful";

const MODE_OPTIONS: { value: AiMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "assisted", label: "Assisted" },
  { value: "semi", label: "Semi" },
  { value: "autonomous", label: "Auto" },
];

const MODE_HELP: Record<AiMode, string> = {
  off: "BizBot stays silent. You handle every reply.",
  assisted: "BizBot writes a draft for every chat. You review and send.",
  semi: "BizBot sends routine replies and drafts the tricky ones for you.",
  autonomous: "BizBot replies on its own when it is confident.",
};

const TONE_OPTIONS: { value: AiTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" },
];

const segmentClass = (on: boolean) =>
  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
  (on
    ? "bg-white text-foreground ring-1 ring-black/[0.06]"
    : "text-text-secondary hover:text-foreground");

export function AiBehaviorCard({
  initialMode,
  initialTone,
  initialLanguage,
  initialAutopay,
}: {
  initialMode: AiMode;
  initialTone: AiTone;
  initialLanguage: string;
  initialAutopay: boolean;
}) {
  const [mode, setMode] = useState<AiMode>(initialMode);
  const [tone, setTone] = useState<AiTone>(initialTone);
  const [language, setLanguage] = useState(initialLanguage);
  const [autopay, setAutopay] = useState(initialAutopay);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isAuto = mode === "autonomous";
  const autopayOn = isAuto && autopay;

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateAiBehaviorAction({
        mode,
        tone,
        language: language.trim(),
        autopay,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setTimeout(function () {
        setSaved(false);
      }, 1800);
    });
  }

  return (
    <section className="rounded-3xl bg-white p-6 ring-1 ring-black/[0.04] sm:p-8">
      <div className="space-y-6">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">BizBot mode</p>
          <div className="mt-2 inline-flex flex-wrap rounded-full bg-surface-muted p-1 ring-1 ring-black/[0.06]">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={segmentClass(mode === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-secondary">{MODE_HELP[mode]}</p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface-muted/50 px-4 py-3 ring-1 ring-black/[0.04]">
          <div className="min-w-0 flex-1">
            <p className={"text-sm font-medium " + (isAuto ? "text-foreground" : "text-text-muted")}>
              Send payment links
            </p>
            <p className="mt-0.5 text-xs text-text-muted">
              {isAuto
                ? "BizBot sends a secure payment link when it confirms an order."
                : "Turn on Auto mode to let BizBot send payment links."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autopayOn}
            aria-label="Send payment links"
            disabled={!isAuto}
            onClick={() => setAutopay((v) => !v)}
            className={
              "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 " +
              (autopayOn ? "bg-brand-primary" : "bg-gray-300")
            }
          >
            <span
              className={
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform " +
                (autopayOn ? "translate-x-5" : "translate-x-0")
              }
            />
          </button>
        </div>

        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted">Tone</p>
          <div className="mt-2 inline-flex flex-wrap rounded-full bg-surface-muted p-1 ring-1 ring-black/[0.06]">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={segmentClass(tone === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="ai_language"
            className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-muted"
          >
            Language
          </label>
          <input
            id="ai_language"
            type="text"
            maxLength={40}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. English"
            className="mt-2 w-full rounded-xl border-0 bg-surface-muted px-4 py-3 text-sm text-foreground ring-1 ring-black/[0.06] placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>

        {error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          {saved ? <span className="text-xs font-medium text-brand-primary">Saved</span> : null}
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </section>
  );
}
