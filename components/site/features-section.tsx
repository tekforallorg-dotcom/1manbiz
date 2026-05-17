"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ShoppingBag,
  Users,
  Receipt,
  LineChart,
  MessageCircle,
  Instagram,
  Mail,
  Check,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

interface FeatureTab {
  id: string;
  icon: LucideIcon;
  label: string;
  headline: string;
  description: string;
  bullets: string[];
}

const TABS: FeatureTab[] = [
  {
    id: "conversations",
    icon: Sparkles,
    label: "Conversations",
    headline: "AI that talks like you do.",
    description:
      "Trained on your prices, hours, and products. Replies to every customer message instantly, in your tone.",
    bullets: [
      "Multi-channel: WhatsApp, Instagram, email, SMS",
      "Trained on your business knowledge",
      "Hands off to you for high-stakes replies",
      "Works 24/7, even at 2am",
    ],
  },
  {
    id: "orders",
    icon: ShoppingBag,
    label: "Orders",
    headline: "Orders that capture themselves.",
    description:
      "Every confirmed purchase becomes a tracked order with the customer, item, and price ready.",
    bullets: [
      "Auto-capture from any chat",
      "Live inventory across channels",
      "Status tracking: pending, paid, delivered",
      "One-tap edits and refunds",
    ],
  },
  {
    id: "customers",
    icon: Users,
    label: "Customers",
    headline: "Customers you actually remember.",
    description:
      "Every chat builds a customer profile. Past orders, preferences, and history. Always at hand.",
    bullets: [
      "Auto-built from conversations",
      "Notes, tags, and preferences",
      "Full order history per customer",
      "Win-back nudges for quiet ones",
    ],
  },
  {
    id: "receipts",
    icon: Receipt,
    label: "Receipts",
    headline: "Receipts and books on autopilot.",
    description:
      "Branded receipts sent automatically. Ledger updates with every sale. Month-end takes minutes.",
    bullets: [
      "Branded receipts in your colours",
      "Sent via WhatsApp or email",
      "Auto-updating sales ledger",
      "Export to PDF, Excel, or accountant",
    ],
  },
  {
    id: "insights",
    icon: LineChart,
    label: "Insights",
    headline: "Insights that make sense.",
    description:
      "See what's selling, who's buying, and where your growth is coming from. No jargon.",
    bullets: [
      "Today, this week, this month",
      "Top products and customers",
      "Channel performance breakdown",
      "Low stock and re-order alerts",
    ],
  },
];

const ease = [0.16, 1, 0.3, 1] as const;

export function FeaturesSection() {
  const [activeId, setActiveId] = useState<string>(TABS[0].id);
  const active = TABS.find((t) => t.id === activeId) ?? TABS[0];

  return (
    <section
      id="features"
      className="relative bg-background py-10 sm:py-16 lg:py-24 overflow-hidden"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 -right-40 w-[700px] h-[700px] bg-brand-soft/30 rounded-full blur-[180px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="THE OPERATING SYSTEM"
          headline="Every tool your business needs."
          subhead="From the first message to the final receipt. One platform handles every step."
        />

        {/* Tab bar */}
        <div className="mt-8 sm:mt-10 flex justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-2xl bg-surface-muted border border-border max-w-full">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === activeId;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveId(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-3.5 sm:px-4 py-2.5 text-[13px] sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap",
                    isActive
                      ? "bg-foreground text-background shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
                      : "text-text-secondary hover:text-foreground hover:bg-surface",
                  )}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panel */}
        <div className="mt-8 sm:mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease }}
              className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-6xl mx-auto"
            >
              <div className="lg:max-w-md">
                <h3 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-[-0.03em] text-foreground leading-[1.05]">
                  {active.headline}
                </h3>
                <p className="mt-5 text-[16px] sm:text-[17px] leading-relaxed text-text-secondary">
                  {active.description}
                </p>
                <ul className="mt-7 space-y-3">
                  {active.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-brand-soft shrink-0">
                        <Check className="h-3 w-3 text-brand-dark" strokeWidth={2.5} />
                      </span>
                      <span className="text-[14.5px] leading-relaxed text-foreground">
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative">
                <FeatureVisual id={active.id} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ─────────── Visual mockups per tab ─────────── */

function FeatureVisual({ id }: { id: string }) {
  switch (id) {
    case "conversations":
      return <ConversationsVisual />;
    case "orders":
      return <OrdersVisual />;
    case "customers":
      return <CustomersVisual />;
    case "receipts":
      return <ReceiptsVisual />;
    case "insights":
      return <InsightsVisual />;
    default:
      return null;
  }
}

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-card border border-border bg-surface p-4 sm:p-5 shadow-[0_30px_80px_rgba(0,0,0,0.06)] max-w-md mx-auto lg:mx-0">
      {children}
    </div>
  );
}

function ConversationsVisual() {
  return (
    <VisualFrame>
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-ai-accent opacity-70 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ai-accent" />
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
            AI Live
          </span>
        </div>
        <span className="text-[10.5px] text-text-muted">3 channels</span>
      </div>
      <div className="space-y-2">
        <ChannelChat icon={MessageCircle} name="Chinedu O." channel="WhatsApp" msg="Is the silk gown still in M?" reply="Yes! ₦18,500. 1 left in M." />
        <ChannelChat icon={Instagram} name="Funmi A." channel="Instagram" msg="Do you do bridal styling?" reply="Yes! Booking opens for May." />
        <ChannelChat icon={Mail} name="Tobi K." channel="Email" msg="Bulk pricing available?" reply="Yes, 10+ gets 15% off." />
      </div>
    </VisualFrame>
  );
}

function ChannelChat({
  icon: Icon,
  name,
  channel,
  msg,
  reply,
}: {
  icon: LucideIcon;
  name: string;
  channel: string;
  msg: string;
  reply: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-muted/40 p-2.5">
      <div className="flex items-center gap-1.5 pb-1.5">
        <Icon className="h-3 w-3 text-brand-primary" strokeWidth={2} />
        <span className="text-[11px] font-semibold text-foreground">{name}</span>
        <span className="text-[10px] text-text-muted">&middot; {channel}</span>
      </div>
      <p className="text-[11.5px] text-text-secondary mb-1 truncate">{msg}</p>
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-2.5 w-2.5 text-brand-primary shrink-0" strokeWidth={2.25} />
        <p className="text-[11.5px] text-foreground font-medium truncate">{reply}</p>
      </div>
    </div>
  );
}

function OrdersVisual() {
  const orders = [
    { name: "Funmi A.", item: "Silk Wrap Gown · M", total: "₦18,500", status: "Pending", tone: "warning" as const },
    { name: "Chinedu O.", item: "Ankara Set · L", total: "₦24,000", status: "Paid", tone: "brand" as const },
    { name: "Adaeze K.", item: "Lace Top · S", total: "₦12,500", status: "Delivered", tone: "muted" as const },
  ];
  return (
    <VisualFrame>
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
        <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
          Today &middot; Orders
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-dark">
          <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.25} />
          +6 today
        </span>
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.name} className="flex items-center justify-between rounded-2xl border border-border bg-surface-muted/40 p-3">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-foreground truncate">{o.name}</p>
              <p className="text-[10.5px] text-text-muted truncate">{o.item}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
              <span className="text-[12.5px] font-semibold text-foreground">{o.total}</span>
              <span
                className={cn(
                  "text-[9.5px] font-semibold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full",
                  o.tone === "brand" && "bg-brand-soft text-brand-dark",
                  o.tone === "warning" && "bg-warning/15 text-warning",
                  o.tone === "muted" && "bg-surface-muted text-text-muted",
                )}
              >
                {o.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </VisualFrame>
  );
}

function CustomersVisual() {
  return (
    <VisualFrame>
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-primary to-brand-dark flex items-center justify-center text-white text-base font-bold shrink-0">
          F
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">Funmi Adeyemi</p>
          <p className="text-[11px] text-text-muted">Customer since Mar 2025 &middot; Lagos</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Orders" value="12" />
        <Stat label="Spent" value="₦184k" />
        <Stat label="Last seen" value="2d" />
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted mb-2">
          Preferences
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["Size M", "Silk fabric", "Pays via transfer", "Ikeja delivery"].map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-dark">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </VisualFrame>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-muted p-2.5">
      <p className="text-[9.5px] uppercase tracking-[0.1em] font-semibold text-text-muted">
        {label}
      </p>
      <p className="text-[14px] font-semibold tracking-tight text-foreground mt-0.5">
        {value}
      </p>
    </div>
  );
}

function ReceiptsVisual() {
  return (
    <VisualFrame>
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
        <div className="flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2} />
          <span className="text-[12px] font-semibold text-foreground">Receipt #1247</span>
        </div>
        <span className="text-[10px] text-text-muted">May 16, 2026</span>
      </div>
      <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
        Adaeze's Boutique
      </p>
      <div className="mt-3 space-y-1.5 text-[12px]">
        <Row label="Silk Wrap Gown · M" value="₦18,500" />
        <Row label="Delivery to Ikeja" value="₦1,500" />
      </div>
      <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
        <span className="text-[12px] font-semibold text-foreground">Total</span>
        <span className="text-[15px] font-bold tracking-tight text-foreground">₦20,000</span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-dark">
          <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
          Paid &middot; Paystack
        </span>
        <span className="text-[10.5px] text-text-muted">Sent via WhatsApp</span>
      </div>
    </VisualFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary truncate mr-3">{label}</span>
      <span className="text-foreground font-medium shrink-0">{value}</span>
    </div>
  );
}

function InsightsVisual() {
  return (
    <VisualFrame>
      <div className="flex items-start justify-between border-b border-border pb-3 mb-3">
        <div>
          <p className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-text-muted">
            This week
          </p>
          <p className="text-[24px] font-bold tracking-[-0.03em] text-foreground mt-1 leading-none">
            ₦284,500
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10.5px] font-semibold text-brand-dark">
          <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.25} />
          +18%
        </span>
      </div>
      <svg viewBox="0 0 260 60" className="w-full h-12 block" preserveAspectRatio="xMidYMid meet" aria-hidden>
        {[35, 60, 42, 70, 52, 78, 95].map((h, i) => {
          const barWidth = 28;
          const gap = 9;
          const totalWidth = 7 * barWidth + 6 * gap;
          const startX = (260 - totalWidth) / 2;
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
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Orders" value="47" />
        <Stat label="Customers" value="32" />
        <Stat label="Conv. rate" value="68%" />
      </div>
    </VisualFrame>
  );
}
