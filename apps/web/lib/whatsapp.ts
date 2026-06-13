/**
 * Normalize a phone number into E.164 digits (no + prefix).
 * Strips spaces, dashes, parens. Adds Nigeria country code (234) if the
 * input looks like a local Nigerian number (starts with 0, length 11).
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Local Nigeria number (e.g. 08012345678) -> 2348012345678
  if (digits.startsWith("0") && digits.length === 11) {
    return "234" + digits.slice(1);
  }
  return digits;
}

/**
 * Build a WhatsApp click-to-chat link with a prefilled message.
 * Returns null if the phone number is missing or invalid (<10 digits).
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a deep link that opens the installed WhatsApp app (desktop or mobile)
 * straight to the chat, instead of the wa.me web interstitial that lands on
 * web.whatsapp.com. Use this for owner-facing chat actions in the dashboard,
 * where WhatsApp is always installed. Keep buildWhatsAppLink (wa.me) for the
 * public catalogue, where a customer may be on a device without the app and
 * needs the web fallback. Returns null if the phone is missing or invalid.
 */
export function buildWhatsAppAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return null;
  return `whatsapp://send?phone=${normalized}&text=${encodeURIComponent(message)}`;
}
