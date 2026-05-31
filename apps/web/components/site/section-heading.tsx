"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  headline: string;
  subhead?: string;
  align?: "left" | "center";
  className?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Reusable section header. Eyebrow renders as a small pill badge
 * (green dot + uppercase label) for premium consistency across sections.
 */
export function SectionHeading({
  eyebrow,
  headline,
  subhead,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.6, ease }}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-surface border border-border px-3.5 py-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.04)]",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-brand-dark">
            {eyebrow}
          </span>
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.75, ease, delay: 0.08 }}
        className="mt-5 text-4xl sm:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.05] text-foreground"
      >
        {headline}
      </motion.h2>
      {subhead && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.75, ease, delay: 0.16 }}
          className={cn(
            "mt-5 text-base sm:text-[17px] leading-relaxed text-text-secondary max-w-2xl",
            align === "center" && "mx-auto",
          )}
        >
          {subhead}
        </motion.p>
      )}
    </div>
  );
}
