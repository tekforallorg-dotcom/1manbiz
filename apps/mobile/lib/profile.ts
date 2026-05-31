/**
 * firstNameFrom — derive a greeting first name from a profile row.
 *
 * { full_name: "Vitalis Mabia", email: "psalms@x.com" } -> "Vitalis"
 * { full_name: "   ",          email: "psalms@x.com" } -> "psalms"
 * { full_name: null,           email: "psalms@x.com" } -> "psalms"
 */
export function firstNameFrom(profile: { full_name: string | null; email: string }): string {
  const trimmed = profile.full_name?.trim();
  if (trimmed && trimmed.length > 0) {
    const first = trimmed.split(/\s+/)[0];
    if (first && first.length > 0) return first;
  }
  return profile.email.split("@")[0] ?? profile.email;
}
