import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
}

/**
 * 1Man.Biz wordmark.
 * Vector-sharp at any size; token-driven so it inherits color
 * from any context (light nav, dark footer, etc.).
 *
 * Structure mirrors the brand:
 *   1Man  → foreground
 *   .Biz  → brand-primary green
 */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-sans font-bold tracking-[-0.045em] leading-none select-none",
        className,
      )}
      aria-label="1Man.Biz"
    >
      <span className="text-foreground">1Man</span>
      <span className="text-brand-primary">.Biz</span>
    </span>
  );
}
