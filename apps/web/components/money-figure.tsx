import { formatNairaFromKobo } from "@/lib/format";

/**
 * The money-figure signature. Renders a naira amount in the display face with
 * the currency mark set smaller and muted, so the amount leads and the symbol
 * supports. Shared by the Money pages and the dashboard revenue hero so every
 * headline figure across the app reads the same way.
 *
 * Pair `.money-figure` (globals.css) for the family, tabular figures, and
 * tracking; size it via `className`.
 */
export function MoneyFigure({
  kobo,
  className,
  markClassName,
}: {
  kobo: number;
  className?: string;
  markClassName?: string;
}) {
  const negative = kobo < 0;
  const formatted = formatNairaFromKobo(Math.abs(kobo)); // e.g. "\u20A62,100,000"
  const digits = formatted.startsWith("\u20A6") ? formatted.slice(1) : formatted;
  return (
    <span className={"money-figure " + (className ?? "")}>
      {negative ? "-" : ""}
      <span
        className={
          "mr-[0.04em] align-[0.08em] text-[0.6em] font-normal opacity-55 " +
          (markClassName ?? "")
        }
      >
        {"\u20A6"}
      </span>
      {digits}
    </span>
  );
}
