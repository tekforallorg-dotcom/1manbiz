/**
 * Currency formatting for Nigerian Naira (NGN).
 *
 * Storage convention: prices are kept as integer kobo (1 Naira = 100 kobo)
 * in the database. Display layer converts to Naira for users. Input parser
 * accepts whatever the user types and normalises to kobo.
 */

const NGN_LOCALE = "en-NG";

/**
 * Format a kobo amount as ₦1,500 or ₦1,500.50.
 * Used in lists, receipts, summaries.
 */
export function formatNairaFromKobo(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString(NGN_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact format for dense dashboards: ₦150k, ₦1.2m.
 * Falls back to full format under 1,000.
 */
export function formatNairaShort(kobo: number): string {
  const naira = kobo / 100;
  if (naira < 1_000) return `₦${Math.round(naira)}`;
  if (naira < 1_000_000) {
    return `₦${(naira / 1_000).toFixed(naira < 10_000 ? 1 : 0)}k`;
  }
  return `₦${(naira / 1_000_000).toFixed(naira < 10_000_000 ? 1 : 0)}m`;
}

/**
 * Parse user input like "1,500", "₦1500", or "1500.50" into kobo for storage.
 * Strips currency symbols, commas, and whitespace. Returns 0 for invalid input.
 */
export function parseNairaInputToKobo(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[₦,\s]/g, "");
  const naira = Number.parseFloat(cleaned);
  if (Number.isNaN(naira) || naira < 0) return 0;
  return Math.round(naira * 100);
}
