"use client";

import { motion } from "motion/react";
import {
  ArrowRight,
  MessageCircle,
  Instagram,
  Mail,
  MessageSquare,
  Globe,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroVisual } from "./hero-visual";

const ease = [0.16, 1, 0.3, 1] as const;
const stagger = 0.08;

const CHANNELS = [
  { Icon: MessageCircle, label: "WhatsApp" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Mail, label: "Email" },
  { Icon: MessageSquare, label: "SMS" },
  { Icon: Globe, label: "Web catalogue" },
  { Icon: CreditCard, label: "Payments" },
];

export function SiteHero() {
  return (
    <section className="relative pt-28 sm:pt-32 lg:pt-24 pb-12 sm:pb-12 lg:pb-12 overflow-hidden">
      {/* Subtle dot-grid texture */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(17,17,17,0.05) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.9), transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.9), transparent 75%)",
        }}
      />

      {/* Soft brand-green ambient glow */}
      <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[10%] left-[60%] -translate-x-1/2 w-[900px] h-[600px] bg-brand-soft/60 blur-[120px] rounded-full" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-10 xl:gap-16 items-center">
          <div className="lg:col-span-7 max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 0 * stagger }}
              className="text-[40px] sm:text-[56px] lg:text-[60px] xl:text-[72px] font-bold tracking-[-0.045em] leading-[1.02] text-foreground"
            >
              One system for every business conversation.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 1 * stagger }}
              className="mt-6 max-w-xl mx-auto lg:mx-0 text-[15px] sm:text-[17px] leading-relaxed text-text-secondary"
            >
              Connect WhatsApp, Instagram, email, SMS, and your business tools
              into one system for orders, customers, receipts, bookings,
              inventory, and growth.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 2 * stagger }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4"
            >
              <Link href="/sign-up" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto group">
                  Start free
                  <ArrowRight
                    className="ml-0.5 h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Button>
              </Link>
              <Link
                href="#workflow"
                className="text-[14px] font-medium text-text-secondary hover:text-foreground transition-colors px-2 py-2 inline-flex items-center gap-1"
              >
                See how it works
                <span aria-hidden>→</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease, delay: 3 * stagger }}
              className="mt-10 flex flex-col sm:flex-row items-center lg:items-center justify-center lg:justify-start gap-3 sm:gap-5"
            >
              <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-muted">
                Connects with
              </span>
              <div
                className="flex items-center gap-4 sm:gap-5"
                role="list"
                aria-label="Supported channels"
              >
                {CHANNELS.map(({ Icon, label }) => (
                  <span
                    key={label}
                    role="listitem"
                    className="text-text-muted hover:text-foreground transition-colors"
                    aria-label={label}
                    title={label}
                  >
                    <Icon
                      className="h-[18px] w-[18px]"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.85, ease, delay: 4 * stagger }}
              className="mt-6 text-[12px] text-text-muted"
            >
              Built for businesses that sell through conversations.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, ease, delay: 5 * stagger }}
            className="lg:col-span-5 mt-6 lg:mt-0"
          >
            <HeroVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
