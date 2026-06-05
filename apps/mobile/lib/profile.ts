/**
 * firstNameFrom. derive a greeting first name from a profile row.
 *
 * { full_name: "Vitalis Mabia", email: "psalms@x.com" } -> "Vitalis"
 * { full_name: "   ",          email: "psalms@x.com" } -> "psalms"
 * { full_name: null,           email: "psalms@x.com" } -> "psalms"
 */
export function firstNameFrom(
  profile: { full_name?: string | null; email?: string | null },
): string {
  const trimmed = profile.full_name?.trim();
  if (trimmed && trimmed.length > 0) {
    const first = trimmed.split(/\s+/)[0];
    if (first && first.length > 0) return first;
  }
  const email = profile.email?.trim();
  if (email && email.length > 0) {
    const localPart = email.split("@")[0];
    if (localPart && localPart.length > 0) return localPart;
    return email;
  }
  return "there";
}
