"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ease = [0.16, 1, 0.3, 1] as const;

export function FinalCTA() {
  return (
    <section className="relative py-10 sm:py-16 lg:py-20 overflow-hidden bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.85, ease }}
          className="relative overflow-hidden rounded-[2rem] bg-foreground p-10 sm:p-14 lg:p-20"
        >
          {/* Decorative atmospheric layers */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-primary/25 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-soft/10 rounded-full blur-[120px] -translate-x-1/3 translate-y-1/3" />
            {/* Subtle dot grid */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,1) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
          </div>

          <div className="relative max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.16em] font-bold text-brand-primary mb-5">
              Start in 5 minutes
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-[60px] font-bold tracking-[-0.04em] leading-[1.05] text-background">
              Stop running on chaos.{" "}
              <span className="text-brand-primary">Start running on 1Man.Biz.</span>
            </h2>
            <p className="mt-5 text-[16px] sm:text-[18px] leading-relaxed text-background/70 max-w-2xl">
              Free to start. No credit card. Set up your business in 5 minutes.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="bg-brand-primary hover:bg-brand-dark text-white group"
                >
                  Start free
                  <ArrowRight
                    className="ml-0.5 h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Button>
              </Link>
              <span className="text-[13px] text-background/50">
                No credit card &middot; Cancel any time
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
