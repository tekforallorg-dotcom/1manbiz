// Currency formatting helpers for mobile UI.
// All monetary values in the DB are stored in kobo (1 NGN = 100 kobo).

export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null || Number.isNaN(kobo)) return "₦ 0";
  const naira = Math.round(kobo / 100);
  return "₦ " + naira.toLocaleString("en-NG");
}

// Returns ISO string for the start of today in UTC.
// TODO: timezone-correct version using Africa/Lagos (UTC+1). Until then,
// rollover happens at 01:00 Lagos time, not midnight.
export function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Short relative-time string for order rows. Mobile-friendly: "2h ago", "yesterday".
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return "yesterday";
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}
