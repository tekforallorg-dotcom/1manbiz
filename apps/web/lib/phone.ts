/**
 * Normalise a user-typed or webhook-received phone string to strict E.164.
 *
 * Returns the canonical "+<country><national>" form on success, or null when
 * the input cannot be reasonably interpreted as a phone number.
 *
 * Supported domestic formats today: NG (default), KE, ZA, GH. Bare-digits
 * inputs are interpreted under defaultCountry; strings that already start
 * with + or with the international 00 prefix are honoured as-is.
 *
 * Examples (defaultCountry "NG"):
 *   "08012345678"        -> "+2348012345678"
 *   "8012345678"         -> "+2348012345678"
 *   "+234 801 234 5678"  -> "+2348012345678"
 *   "002348012345678"    -> "+2348012345678"
 *   "234 801 234 5678"   -> "+2348012345678"
 *   "+254 700 123 456"   -> "+254700123456"
 *   "abc"                -> null
 *   "12345"              -> null
 */
export type SupportedCountry = "NG" | "KE" | "ZA" | "GH";

interface CountrySpec {
  dialCode: string;
  nationalLength: number;
}

const COUNTRY_SPECS: Record<SupportedCountry, CountrySpec> = {
  NG: { dialCode: "234", nationalLength: 10 },
  KE: { dialCode: "254", nationalLength: 9 },
  ZA: { dialCode: "27", nationalLength: 9 },
  GH: { dialCode: "233", nationalLength: 9 },
};

export function normalizePhoneE164(
  input: string | null | undefined,
  defaultCountry: SupportedCountry = "NG",
): string | null {
  if (!input) return null;

  // Strip all whitespace and common formatting characters.
  let raw = input.replace(/[\s\-().]/g, "");

  // Treat leading 00 as international prefix.
  if (raw.startsWith("00")) raw = "+" + raw.slice(2);

  // Already in plus form: validate and return.
  if (raw.startsWith("+")) {
    const digits = raw.slice(1);
    if (!/^\d+$/.test(digits)) return null;
    if (digits.length < 8 || digits.length > 15) return null;
    return "+" + digits;
  }

  // Bare digits past this point.
  if (!/^\d+$/.test(raw)) return null;

  const spec = COUNTRY_SPECS[defaultCountry];

  // Bare digits already in <dial><national> form.
  if (
    raw.startsWith(spec.dialCode) &&
    raw.length === spec.dialCode.length + spec.nationalLength
  ) {
    return "+" + raw;
  }

  // Domestic format with leading 0.
  if (raw.startsWith("0") && raw.length === spec.nationalLength + 1) {
    return "+" + spec.dialCode + raw.slice(1);
  }

  // National number without leading 0.
  if (raw.length === spec.nationalLength) {
    return "+" + spec.dialCode + raw;
  }

  return null;
}

/**
 * Format an E.164 phone for friendly display. Currently passthrough; future
 * polish slice can add per-country grouping like "+234 801 234 5678".
 */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  return e164 ?? "";
}
