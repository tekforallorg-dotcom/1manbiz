"use client";

import { motion } from "motion/react";
import {
  Shirt,
  Cake,
  Scissors,
  Sparkles as SparklesIcon,
  Wrench,
  Truck,
  ShoppingBasket,
  Store,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

interface Persona {
  icon: LucideIcon;
  label: string;
  sub: string;
}

const PERSONAS: Persona[] = [
  { icon: Shirt, label: "Fashion vendors", sub: "Boutiques, online resellers" },
  { icon: Cake, label: "Bakers & food", sub: "Cakes, snacks, restaurants" },
  { icon: Scissors, label: "Tailors", sub: "Custom orders, alterations" },
  { icon: SparklesIcon, label: "Salons & spas", sub: "Stylists, beauty pros" },
  { icon: Wrench, label: "Mechanics", sub: "Repair shops, parts" },
  { icon: Truck, label: "Logistics", sub: "Riders, drivers, dispatch" },
  { icon: ShoppingBasket, label: "Market sellers", sub: "Open markets, traders" },
  { icon: Store, label: "Retail shops", sub: "General merchandise" },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function PersonasSection() {
  return (
    <section
      id="personas"
      className="relative bg-surface-muted py-10 sm:py-16 lg:py-24 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-brand-soft/35 rounded-full blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="BUILT FOR HOW YOU SELL"
          headline="If your business runs on conversations, this is for you."
          subhead="From fashion to mechanics. 1Man.Biz adapts to how you actually work."
        />

        <div className="mt-10 sm:mt-12 lg:mt-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto">
          {PERSONAS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease, delay: i * 0.04 }}
              className="group relative rounded-2xl border border-border bg-surface p-5 hover:border-brand-primary/25 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] transition-all duration-300"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-soft text-brand-dark group-hover:scale-[1.05] transition-transform duration-300">
                <p.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <p className="mt-4 text-[14.5px] font-semibold tracking-[-0.01em] text-foreground">
                {p.label}
              </p>
              <p className="mt-0.5 text-[12px] text-text-muted leading-relaxed">
                {p.sub}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
