"use client";

import { motion } from "motion/react";
import { Check, ArrowRight } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "Free",
    period: "forever",
    description: "Test 1Man.Biz on your business with no risk.",
    features: [
      "50 AI replies / month",
      "WhatsApp connector",
      "Up to 50 orders",
      "Basic ledger",
      "Receipts via WhatsApp",
    ],
    cta: "Start free",
  },
  {
    name: "Growth",
    price: "₦5,000",
    period: "/month",
    description: "For active shops. All channels, no limits.",
    features: [
      "1,000 AI replies / month",
      "All channels: WA, IG, email, SMS",
      "Unlimited orders & inventory",
      "Full ledger + branded receipts",
      "Customer CRM",
      "Bookings calendar",
      "Insights dashboard",
    ],
    cta: "Start 14-day trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "₦15,000",
    period: "/month",
    description: "For teams. Multiple staff, priority support.",
    features: [
      "Unlimited AI replies",
      "All channels + custom integrations",
      "Multi-staff access",
      "Custom branding",
      "Priority support",
      "API access",
      "Dedicated onboarding",
    ],
    cta: "Contact sales",
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative bg-background py-10 sm:py-16 lg:py-24 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-brand-soft/30 rounded-full blur-[180px] translate-x-1/3 -translate-y-1/3" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="SIMPLE PRICING"
          headline="Start free. Scale as you grow."
          subhead="No setup fees. No long contracts. Cancel any time."
        />

        <div className="mt-10 sm:mt-12 lg:mt-16 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto items-start">
          {TIERS.map((tier, i) => (
            <PricingCard key={tier.name} tier={tier} delay={i * 0.08} />
          ))}
        </div>

        <p className="mt-10 text-center text-[13px] text-text-muted">
          Prices in Nigerian Naira. VAT-inclusive. Multi-currency coming soon.
        </p>
      </div>
    </section>
  );
}

function PricingCard({ tier, delay }: { tier: Tier; delay: number }) {
  const isDark = !!tier.highlighted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.65, ease, delay }}
      className={cn(
        "relative rounded-card p-7 sm:p-8 transition-all duration-500",
        isDark
          ? "bg-foreground border border-foreground shadow-[0_30px_80px_rgba(0,0,0,0.22)] lg:scale-[1.03] z-10"
          : "bg-surface border border-border hover:border-brand-primary/25 hover:shadow-[0_18px_40px_rgba(0,0,0,0.06)]",
      )}
    >
      {isDark && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-brand-primary px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(22,163,74,0.4)]">
          Most Popular
        </div>
      )}

      <p
        className={cn(
          "text-[11px] uppercase tracking-[0.16em] font-bold",
          isDark ? "text-brand-soft" : "text-brand-primary",
        )}
      >
        {tier.name}
      </p>

      <div className="mt-4 flex items-baseline gap-1">
        <span
          className={cn(
            "text-4xl sm:text-[44px] font-bold tracking-[-0.035em]",
            isDark ? "text-background" : "text-foreground",
          )}
        >
          {tier.price}
        </span>
        <span
          className={cn(
            "text-[14px] font-medium",
            isDark ? "text-background/60" : "text-text-muted",
          )}
        >
          {tier.period}
        </span>
      </div>

      <p
        className={cn(
          "mt-3 text-[13.5px] leading-relaxed",
          isDark ? "text-background/70" : "text-text-secondary",
        )}
      >
        {tier.description}
      </p>

      <Button
        size="lg"
        className={cn(
          "mt-6 w-full group",
          isDark && "bg-brand-primary hover:bg-brand-dark text-white",
        )}
      >
        {tier.cta}
        <ArrowRight
          className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </Button>

      <ul
        className={cn(
          "mt-7 space-y-3 pt-6 border-t",
          isDark ? "border-background/10" : "border-border",
        )}
      >
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex items-center justify-center w-4 h-4 rounded-full shrink-0",
                isDark ? "bg-brand-primary/25" : "bg-brand-soft",
              )}
            >
              <Check
                className={cn(
                  "h-2.5 w-2.5",
                  isDark ? "text-brand-primary" : "text-brand-dark",
                )}
                strokeWidth={2.5}
              />
            </span>
            <span
              className={cn(
                "text-[13.5px] leading-relaxed",
                isDark ? "text-background/90" : "text-foreground",
              )}
            >
              {f}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
