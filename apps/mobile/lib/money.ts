// Money helpers for mobile. Fees are stored in kobo (1 NGN = 100 kobo);
// conversion happens only at this display/parse boundary.

export function formatNairaFromKobo(kobo: number): string {
  const naira = Math.round(kobo) / 100;
  const hasFraction = naira % 1 !== 0;
  const [whole = "", frac] = naira.toFixed(hasFraction ? 2 : 0).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "\u20A6" + grouped + (frac ? "." + frac : "");
}

// Returns kobo as a non-negative integer, or null if the input is not a valid
// amount (lets callers tell a real 0 apart from a typo / empty field).
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return null;
  const naira = Number(cleaned);
  if (!Number.isFinite(naira) || naira < 0) return null;
  return Math.round(naira * 100);
}
