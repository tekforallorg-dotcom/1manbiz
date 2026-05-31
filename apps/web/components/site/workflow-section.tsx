"use client";

import { motion } from "motion/react";
import {
  MessageCircle,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Database,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

interface Step {
  num: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    icon: MessageCircle,
    label: "Message arrives",
    description: "A customer reaches you on WhatsApp, Instagram, or email.",
  },
  {
    num: "02",
    icon: Sparkles,
    label: "AI replies",
    description: "Instantly. In your tone. With your prices, hours, and policies.",
  },
  {
    num: "03",
    icon: ShoppingBag,
    label: "Order captures",
    description: "When the customer confirms, the order is tracked automatically.",
  },
  {
    num: "04",
    icon: CreditCard,
    label: "Payment + receipt",
    description: "Paystack, Flutterwave, or transfer. Receipt sent the moment they pay.",
  },
  {
    num: "05",
    icon: Database,
    label: "Everything updates",
    description: "Inventory, customer record, ledger, insights. All in real-time.",
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="relative bg-background py-10 sm:py-16 lg:py-24 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-brand-soft/25 rounded-full blur-[160px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="HOW IT WORKS"
          headline="One message in. Everything else handled."
          subhead="From the first hello to the final receipt. Every step happens automatically."
        />

        {/* DESKTOP: horizontal 5-step stepper */}
        <div className="hidden lg:block mt-10 lg:mt-14">
          <div className="relative">
            {/* Connecting line behind icons */}
            <div
              aria-hidden
              className="absolute left-12 right-12 top-[88px] h-px bg-gradient-to-r from-transparent via-border to-transparent"
            />
            <div className="relative grid grid-cols-5 gap-3">
              {STEPS.map((step, i) => (
                <StepDesktop key={step.num} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>

        {/* MOBILE / TABLET: vertical stepper */}
        <div className="lg:hidden mt-8 sm:mt-10">
          <div className="relative">
            {/* Vertical line */}
            <div
              aria-hidden
              className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-border via-border to-transparent"
            />
            <div className="space-y-5">
              {STEPS.map((step, i) => (
                <StepMobile key={step.num} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepDesktop({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease, delay: index * 0.1 }}
      className="relative flex flex-col items-start"
    >
      <span className="text-[10.5px] font-mono font-bold tracking-[0.15em] text-brand-primary uppercase">
        Step {step.num}
      </span>
      <div className="mt-3 relative flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
        <Icon className="h-5 w-5 text-brand-dark" strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground tracking-[-0.02em]">
        {step.label}
      </h3>
      <p className="mt-1.5 text-[13.5px] text-text-secondary leading-relaxed">
        {step.description}
      </p>
    </motion.div>
  );
}

function StepMobile({ step, index }: { step: Step; index: number }) {
  const Icon = step.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, ease, delay: index * 0.08 }}
      className="relative flex gap-5"
    >
      <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-surface border border-border shadow-[0_4px_14px_rgba(0,0,0,0.04)] shrink-0 z-10">
        <Icon className="h-5 w-5 text-brand-dark" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <span className="text-[10.5px] font-mono font-bold tracking-[0.15em] text-brand-primary uppercase">
          Step {step.num}
        </span>
        <h3 className="mt-1 text-lg font-semibold text-foreground tracking-[-0.02em]">
          {step.label}
        </h3>
        <p className="mt-1.5 text-[14px] text-text-secondary leading-relaxed">
          {step.description}
        </p>
      </div>
    </motion.div>
  );
}
