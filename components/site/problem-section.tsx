"use client";

import { motion } from "motion/react";
import { SectionHeading } from "./section-heading";

interface PainPoint {
  headline: string;
  description: string;
}

const PAIN_POINTS: PainPoint[] = [
  {
    headline: "Stop losing orders to chaos",
    description:
      "Every WhatsApp, Instagram, and email message becomes a tracked order. Nothing slips between channels.",
  },
  {
    headline: "Stop guessing what's left",
    description:
      "Live inventory updates the moment something sells. See exactly what's available on every channel.",
  },
  {
    headline: "Stop typing the same answer 50 times",
    description:
      "AI replies in your tone with prices, sizes, hours, and delivery. Instantly, day and night.",
  },
  {
    headline: "Stop forgetting your customers",
    description:
      "Every chat builds a customer record. Names, history, and preferences. Remembered automatically.",
  },
  {
    headline: "Stop scrambling at month-end",
    description:
      "Sales, receipts, and your ledger update in real-time. Your books balance without effort.",
  },
  {
    headline: "Stop missing what matters",
    description:
      "See what's selling, who's buying, and what's low on stock. All in one calm dashboard.",
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="relative bg-surface-muted pt-6 pb-10 sm:pt-10 sm:pb-16 lg:pt-14 lg:pb-24 overflow-hidden"
    >
      {/* Atmospheric layers */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-brand-soft/45 rounded-full blur-[160px]" />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-brand-primary/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="DAILY CHAOS, ENDED"
          headline="Six daily problems. One calm system."
          subhead="Every SME owner knows the chaos. 1Man.Biz turns it into one system that just works."
        />

        <div className="mt-10 sm:mt-12 lg:mt-16 divide-y divide-border/70">
          {PAIN_POINTS.map((p, i) => (
            <motion.div
              key={p.headline}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              className="grid grid-cols-[auto_1fr] md:grid-cols-[72px_1.1fr_1.4fr] gap-x-5 md:gap-x-10 gap-y-1.5 py-7 md:py-9 group hover:bg-surface/40 transition-colors duration-500 rounded-2xl md:px-4 md:-mx-4"
            >
              <span className="text-xl md:text-2xl font-mono font-bold text-brand-primary tabular-nums leading-none pt-1.5 group-hover:text-brand-dark transition-colors">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl md:text-[26px] font-bold tracking-[-0.025em] text-foreground leading-[1.15]">
                {p.headline}
              </h3>
              <p className="col-span-2 md:col-span-1 text-[14.5px] leading-relaxed text-text-secondary md:pt-1.5">
                {p.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
