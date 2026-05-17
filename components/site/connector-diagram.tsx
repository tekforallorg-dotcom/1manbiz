"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import {
  MessageCircle,
  Instagram,
  Mail,
  MessageSquare,
  Globe,
  ShoppingBag,
  Receipt,
  Package,
  Users,
  LineChart,
  Sparkles,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";

const channels: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "wa", label: "WhatsApp", icon: MessageCircle },
  { id: "ig", label: "Instagram", icon: Instagram },
  { id: "em", label: "Email", icon: Mail },
  { id: "sms", label: "SMS", icon: MessageSquare },
  { id: "web", label: "Web Catalogue", icon: Globe },
];

const outputs: Array<{ id: string; label: string; icon: LucideIcon }> = [
  { id: "ord", label: "Orders", icon: ShoppingBag },
  { id: "rec", label: "Receipts", icon: Receipt },
  { id: "inv", label: "Inventory", icon: Package },
  { id: "cust", label: "Customers", icon: Users },
  { id: "ins", label: "Insights", icon: LineChart },
];

const ease = [0.16, 1, 0.3, 1] as const;
// 5 evenly-spaced y positions in 0–100 viewBox space.
// These map approximately to the rendered HTML node centers.
const Y_POSITIONS = [10, 30, 50, 70, 90] as const;

export function ConnectorDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <div ref={ref} className="relative max-w-5xl mx-auto">
      {/* ───────── MOBILE / TABLET: stacked layout ───────── */}
      <div className="lg:hidden flex flex-col items-center gap-7">
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {channels.map((c, i) => (
            <Node
              key={c.id}
              icon={c.icon}
              label={c.label}
              inView={inView}
              delay={i * 0.06}
            />
          ))}
        </div>

        <DownArrow inView={inView} delay={0.4} />

        <CoreNode inView={inView} delay={0.5} />

        <DownArrow inView={inView} delay={0.7} />

        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {outputs.map((o, i) => (
            <Node
              key={o.id}
              icon={o.icon}
              label={o.label}
              inView={inView}
              delay={0.8 + i * 0.06}
            />
          ))}
        </div>
      </div>

      {/* ───────── DESKTOP: horizontal with animated lines ───────── */}
      <div className="hidden lg:block relative">
        {/* SVG overlay for connecting lines. Uses 0–100 normalized viewBox
            with preserveAspectRatio="none" so it stretches to fill the grid.
            `vectorEffect=non-scaling-stroke` keeps stroke width consistent. */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Lines: left column → center */}
          {Y_POSITIONS.map((y, i) => (
            <motion.path
              key={`l-${i}`}
              d={`M 30 ${y} Q 42 ${y} 50 50`}
              fill="none"
              stroke="var(--brand-primary)"
              strokeOpacity="0.4"
              strokeWidth="1.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{
                duration: 1.2,
                ease: "easeOut",
                delay: 0.5 + i * 0.1,
              }}
            />
          ))}
          {/* Lines: center → right column */}
          {Y_POSITIONS.map((y, i) => (
            <motion.path
              key={`r-${i}`}
              d={`M 50 50 Q 58 ${y} 70 ${y}`}
              fill="none"
              stroke="var(--brand-primary)"
              strokeOpacity="0.4"
              strokeWidth="1.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
              transition={{
                duration: 1.2,
                ease: "easeOut",
                delay: 1.0 + i * 0.1,
              }}
            />
          ))}
        </svg>

        {/* Nodes layout — sits ABOVE the SVG (z-10) */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-12 xl:gap-16 items-center relative z-10">
          <div className="space-y-2 sm:space-y-2.5">
            {channels.map((c, i) => (
              <Node
                key={c.id}
                icon={c.icon}
                label={c.label}
                inView={inView}
                delay={i * 0.08}
              />
            ))}
          </div>

          <CoreNode inView={inView} delay={0.5} />

          <div className="space-y-2 sm:space-y-2.5">
            {outputs.map((o, i) => (
              <Node
                key={o.id}
                icon={o.icon}
                label={o.label}
                inView={inView}
                delay={1.0 + i * 0.08}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Channel / Output node ───────────── */

function Node({
  icon: Icon,
  label,
  inView,
  delay,
}: {
  icon: LucideIcon;
  label: string;
  inView: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ duration: 0.55, ease, delay }}
      className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.03)]"
    >
      <Icon className="h-4 w-4 text-text-secondary shrink-0" strokeWidth={1.75} />
      <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
        {label}
      </span>
    </motion.div>
  );
}

/* ───────────── Central 1Man.Biz core ───────────── */

function CoreNode({
  inView,
  delay,
}: {
  inView: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.7, ease, delay }}
      className="relative inline-flex"
    >
      {/* Pulse aura — fires after core appears, repeats forever */}
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-3xl bg-brand-primary"
        animate={
          inView
            ? { scale: [1, 1.25, 1.25], opacity: [0.25, 0, 0] }
            : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeOut",
          delay: delay + 0.4,
        }}
      />
      {/* Main badge */}
      <div className="relative inline-flex items-center gap-2.5 rounded-3xl border border-border bg-surface px-5 py-3.5 shadow-[0_12px_40px_rgba(22,163,74,0.18)]">
        <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-brand-primary" strokeWidth={2} />
        </div>
        <span className="font-bold tracking-[-0.02em] text-[15px]">
          <span className="text-foreground">1Man</span>
          <span className="text-brand-primary">.Biz</span>
        </span>
      </div>
    </motion.div>
  );
}

/* ───────────── Down arrow (mobile only) ───────────── */

function DownArrow({
  inView,
  delay,
}: {
  inView: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.5, ease, delay }}
      className="text-text-muted"
      aria-hidden
    >
      <ArrowDown className="h-5 w-5" strokeWidth={1.75} />
    </motion.div>
  );
}
