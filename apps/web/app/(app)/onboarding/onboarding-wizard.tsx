"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  Instagram,
  Mail,
  MessageSquare,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { completeOnboardingAction } from "./actions";

const STEPS = ["Business", "Channels", "AI tone"] as const;
type StepIndex = 0 | 1 | 2;

const CATEGORIES = [
  "Fashion & clothing",
  "Food & restaurant",
  "Bakery",
  "Beauty & salon",
  "Tailoring",
  "Mechanics & auto",
  "Retail shop",
  "Service business",
  "Other",
] as const;

const CHANNELS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "email", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "web", label: "Web Catalogue", icon: Globe },
];

const TONES = [
  { id: "friendly", label: "Friendly", description: "Warm and conversational" },
  { id: "formal", label: "Formal", description: "Professional and precise" },
  { id: "playful", label: "Playful", description: "Fun and energetic" },
] as const;

export default function OnboardingWizard({ userName }: { userName: string }) {
  const [step, setStep] = useState<StepIndex>(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [tone, setTone] = useState<string>("friendly");

  function validateAndNext() {
    setError(null);
    if (step === 0) {
      if (!businessName.trim()) {
        setError("Please enter your business name.");
        return;
      }
      if (!category) {
        setError("Please pick a category.");
        return;
      }
    }
    if (step === 1 && channels.length === 0) {
      setError("Pick at least one channel.");
      return;
    }
    if (step < 2) setStep((step + 1) as StepIndex);
  }

  function prev() {
    setError(null);
    if (step > 0) setStep((step - 1) as StepIndex);
  }

  function toggleChannel(id: string) {
    setChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction({
        businessName: businessName.trim(),
        category,
        channels,
        tone,
      });
      if (result?.error) {
        setError(result.error);
      }
      // Otherwise server redirected to /dashboard
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-muted">
      <header className="py-6 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="inline-flex items-baseline font-bold tracking-[-0.02em] text-[22px]">
          <span className="text-foreground">1Man</span>
          <span className="text-brand-primary">.Biz</span>
        </div>
        <span className="text-[12.5px] text-text-muted">
          Step {step + 1} of 3
        </span>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 pt-4 pb-12">
        <div className="w-full max-w-xl">
          {/* Progress bar */}
          <div className="mb-7 flex items-center gap-3">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1">
                <div
                  className={cn(
                    "h-1 rounded-full transition-colors duration-300",
                    i <= step ? "bg-brand-primary" : "bg-border",
                  )}
                />
                <p
                  className={cn(
                    "mt-2 text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors",
                    i === step
                      ? "text-foreground"
                      : i < step
                        ? "text-brand-primary"
                        : "text-text-muted",
                  )}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-surface rounded-card border border-border shadow-[0_24px_60px_rgba(0,0,0,0.06)] p-7 sm:p-8">
            {/* STEP 0: Business */}
            {step === 0 && (
              <div>
                <h2 className="text-2xl sm:text-[26px] font-bold tracking-[-0.025em] text-foreground leading-tight">
                  {userName ? `Tell us about your business, ${userName.split(" ")[0]}` : "Tell us about your business"}
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary">
                  We'll use this to personalize your dashboard.
                </p>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="business_name">Business name</Label>
                    <Input
                      id="business_name"
                      type="text"
                      placeholder="Adaeze's Boutique"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="mt-1.5"
                      disabled={isPending}
                    />
                  </div>

                  <div>
                    <Label>What do you sell?</Label>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCategory(c)}
                          disabled={isPending}
                          className={cn(
                            "rounded-xl border px-3 py-2.5 text-[13px] font-medium text-left transition-all duration-200",
                            category === c
                              ? "border-brand-primary bg-brand-soft text-brand-dark"
                              : "border-border bg-surface text-text-secondary hover:border-text-muted hover:text-foreground",
                          )}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Channels */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl sm:text-[26px] font-bold tracking-[-0.025em] text-foreground leading-tight">
                  Where do customers reach you?
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary">
                  Pick all that apply. You can add more later.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CHANNELS.map((c) => {
                    const Icon = c.icon;
                    const selected = channels.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleChannel(c.id)}
                        disabled={isPending}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                          selected
                            ? "border-brand-primary bg-brand-soft"
                            : "border-border bg-surface hover:border-text-muted",
                        )}
                      >
                        <span
                          className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                            selected
                              ? "bg-surface text-brand-dark"
                              : "bg-surface-muted text-text-secondary",
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <span
                          className={cn(
                            "flex-1 text-[14px] font-semibold",
                            selected ? "text-brand-dark" : "text-foreground",
                          )}
                        >
                          {c.label}
                        </span>
                        {selected && (
                          <Check
                            className="h-4 w-4 text-brand-primary"
                            strokeWidth={2.5}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: AI Tone */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl sm:text-[26px] font-bold tracking-[-0.025em] text-foreground leading-tight">
                  How should AI speak to your customers?
                </h2>
                <p className="mt-2 text-[14px] text-text-secondary">
                  Pick a starting tone. You can fine-tune it any time.
                </p>

                <div className="mt-6 space-y-2">
                  {TONES.map((t) => {
                    const selected = tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id)}
                        disabled={isPending}
                        className={cn(
                          "w-full flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                          selected
                            ? "border-brand-primary bg-brand-soft"
                            : "border-border bg-surface hover:border-text-muted",
                        )}
                      >
                        <div className="min-w-0">
                          <p
                            className={cn(
                              "text-[15px] font-semibold",
                              selected ? "text-brand-dark" : "text-foreground",
                            )}
                          >
                            {t.label}
                          </p>
                          <p
                            className={cn(
                              "mt-0.5 text-[12.5px]",
                              selected
                                ? "text-brand-dark/80"
                                : "text-text-muted",
                            )}
                          >
                            {t.description}
                          </p>
                        </div>
                        {selected && (
                          <Check
                            className="h-4 w-4 text-brand-primary shrink-0"
                            strokeWidth={2.5}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-xl bg-warning/10 border border-warning/20 px-3.5 py-2.5 text-[13px] text-warning">
                {error}
              </div>
            )}

            <div className="mt-7 flex items-center justify-between">
              <button
                type="button"
                onClick={prev}
                disabled={step === 0 || isPending}
                className="inline-flex items-center gap-1 text-[14px] font-medium text-text-secondary hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>

              {step < 2 ? (
                <Button onClick={validateAndNext} disabled={isPending} className="group">
                  Continue
                  <ArrowRight
                    className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isPending}>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Finish setup
                      <Check className="ml-0.5 h-4 w-4" strokeWidth={2.5} />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
