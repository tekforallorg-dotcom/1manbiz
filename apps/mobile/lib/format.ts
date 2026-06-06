// Currency formatting helpers for mobile UI.
// All monetary values in the DB are stored in kobo (1 NGN = 100 kobo).

export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null || Number.isNaN(kobo)) return "₦ 0";
  const naira = Math.round(kobo / 100);
  return "₦ " + naira.toLocaleString("en-NG");
}

// Same value as formatNaira, split so the symbol can render at a lighter weight
// than the amount. The bold Naira glyph shows a slash artifact in our font, so
// large headline figures draw the symbol separately, not in bold.
export function nairaParts(kobo: number | null | undefined): { symbol: string; amount: string } {
  const naira = kobo == null || Number.isNaN(kobo) ? 0 : Math.round(kobo / 100);
  return { symbol: "\u20A6", amount: naira.toLocaleString("en-NG") };
}

// Returns ISO string for the start of today in UTC.
// TODO: timezone-correct version using Africa/Lagos (UTC+1). Until then,
// rollover happens at 01:00 Lagos time, not midnight.
export function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// Long-form date+time for detail screens: "19 May 2026, 14:32".
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date}, ${time}`;
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

// Compact relative time for inbox row: "just now", "5m", "2h", "Yesterday", "Mar 5".
// Differs from relativeTime above by omitting the "ago" suffix and using the
// label "Yesterday" instead of relativeTime's "yesterday".
export function relativeTimeShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const min = Math.floor(diffMs / 60000);

  if (min < 1) return "just now";
  if (min < 60) return min + "m";
  const hr = Math.floor(min / 60);
  if (hr < 24 && then.toDateString() === now.toDateString()) return hr + "h";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (then.toDateString() === yesterday.toDateString()) return "Yesterday";

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString("en-NG", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

// HH:MM 24h time for message bubble timestamps.
export function formatMessageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

