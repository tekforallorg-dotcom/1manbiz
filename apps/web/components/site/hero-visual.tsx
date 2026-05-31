"use client";

import { motion } from "motion/react";
import {
  MessageCircle,
  ShoppingBag,
  Receipt,
  Sparkles,
  TrendingUp,
  Check,
} from "lucide-react";

export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Outer padding: pt-44 (above WhatsApp) / pb-40 (below Receipt) */}
      <div className="relative pt-44 pb-40 sm:pt-52 sm:pb-40">
        <div className="relative max-w-md mx-auto">
          <DashboardCard />

          <FloatingCard
            className="hidden sm:block absolute -top-48 -left-8 sm:-left-12 lg:-left-16 w-[180px] z-20"
            rotate="-3.5deg"
            duration={6}
            delay={0}
          >
            <WhatsAppCard />
          </FloatingCard>

          <FloatingCard
            className="hidden sm:block absolute -top-44 -right-2 sm:-right-4 lg:-right-8 w-[165px] z-20"
            rotate="3deg"
            duration={7}
            delay={0.6}
          >
            <OrderCard />
          </FloatingCard>

          <FloatingCard
            className="hidden sm:block absolute -bottom-40 -right-2 sm:-right-4 lg:-right-10 w-[180px] z-20"
            rotate="-3deg"
            duration={8}
            delay={1.2}
          >
            <ReceiptCard />
          </FloatingCard>
        </div>
      </div>
    </div>
  );
}

function FloatingCard({
  children,
  className,
  rotate,
  duration,
  delay,
}: {
  children: React.ReactNode;
  className: string;
  rotate: string;
  duration: number;
  delay: number;
}) {
  return (
    <motion.div
      className={className}
      style={{ rotate }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

function DashboardCard() {
  return (
    <div className="rounded-card border border-border bg-surface shadow-[0_30px_80px_rgba(0,0,0,0.08)] p-5 sm:p-6 relative z-10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-ai-accent opacity-70 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ai-accent" />
            </span>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-text-muted font-semibold">
              Today &middot; Live
            </p>
          </div>
          <p className="mt-1.5 text-[30px] sm:text-[34px] font-semibold tracking-[-0.035em] text-foreground leading-none">
            ₦284,500
          </p>
          <p className="mt-1 text-[11px] text-text-muted truncate">
            Adaeze&apos;s Boutique
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand-dark">
          <TrendingUp className="h-3 w-3" strokeWidth={2.25} />
          +18%
        </span>
      </div>

      <div className="mt-5">
        <svg
          viewBox="0 0 300 60"
          className="w-full h-14 block"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {[35, 60, 42, 70, 52, 78, 95].map((h, i) => {
            const barWidth = 32;
            const gap = 11;
            const totalWidth = 7 * barWidth + 6 * gap;
            const startX = (300 - totalWidth) / 2;
            const x = startX + i * (barWidth + gap);
            const barHeight = (h / 100) * 56;
            const y = 60 - barHeight;
            const isToday = i === 6;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                className={isToday ? "fill-brand-primary" : "fill-brand-soft"}
              />
            );
          })}
        </svg>
        <div className="mt-1.5 grid grid-cols-7 text-[9.5px] text-text-muted font-medium text-center">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span className="text-foreground font-semibold">Today</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <Kpi label="Orders" value="24" sub="+6 today" />
        <Kpi label="Customers" value="187" sub="+12 new" />
        <Kpi label="Receipts" value="22" sub="all sent" />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl bg-surface-muted p-2.5">
      <p className="text-[9.5px] uppercase tracking-[0.1em] text-text-muted font-semibold">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground leading-none">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-text-muted">{sub}</p>
    </div>
  );
}

function WhatsAppCard() {
  return (
    <div className="rounded-3xl bg-surface border border-border shadow-[0_24px_60px_rgba(0,0,0,0.12)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-border">
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center text-white text-[11px] font-semibold">
          C
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
            Chinedu O.
          </p>
          <p className="text-[10px] text-text-muted leading-tight">via WhatsApp</p>
        </div>
        <MessageCircle className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2} />
      </div>
      <div className="p-3 space-y-2 bg-surface-muted/40">
        <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-surface px-3 py-1.5 text-[11.5px] text-foreground border border-border">
          Is the silk gown still in size M?
        </div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-brand-primary px-3 py-1.5 text-[11.5px] text-white">
          Yes! ₦18,500. 1 left in M. Reserve it?
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[9.5px] font-semibold text-brand-dark">
          <Sparkles className="h-2.5 w-2.5" strokeWidth={2.25} />
          AI replied &middot; 1.2s
        </div>
      </div>
    </div>
  );
}

function OrderCard() {
  return (
    <div className="rounded-3xl bg-surface border border-border shadow-[0_24px_60px_rgba(0,0,0,0.12)] p-3.5">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
          <ShoppingBag className="h-2.5 w-2.5" strokeWidth={2.25} />
          New order
        </span>
        <span className="text-[10px] text-text-muted">2m</span>
      </div>
      <p className="mt-2.5 text-[9.5px] uppercase tracking-[0.1em] text-text-muted font-semibold">
        Customer
      </p>
      <p className="text-[12.5px] font-semibold text-foreground leading-tight">
        Funmi Adeyemi
      </p>
      <p className="mt-2 text-[9.5px] uppercase tracking-[0.1em] text-text-muted font-semibold">
        Item
      </p>
      <p className="text-[11.5px] text-foreground leading-snug">
        Silk Wrap Gown &middot; M
      </p>
      <div className="mt-2.5 pt-2.5 border-t border-border flex items-center justify-between">
        <span className="text-[14px] font-semibold tracking-tight text-foreground">
          ₦18,500
        </span>
        <span className="inline-flex items-center rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
          Pending
        </span>
      </div>
    </div>
  );
}

function ReceiptCard() {
  return (
    <div className="rounded-3xl bg-surface border border-border shadow-[0_24px_60px_rgba(0,0,0,0.12)] p-3.5">
      <div className="flex items-center justify-between border-b border-border pb-2 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2} />
          <span className="text-[10.5px] font-semibold text-foreground">
            Receipt #1247
          </span>
        </div>
        <span className="text-[10px] text-text-muted">May 16</span>
      </div>
      <div className="space-y-1 text-[11px]">
        <Row label="Silk gown" value="₦18,500" />
        <Row label="Delivery" value="₦1,500" />
      </div>
      <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between">
        <span className="text-[10.5px] font-semibold text-foreground">Total</span>
        <span className="text-[13px] font-semibold tracking-tight text-foreground">
          ₦20,000
        </span>
      </div>
      <div className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold text-brand-dark">
        <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
        Paid &middot; Paystack
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
