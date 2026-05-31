/**
 * Normalize a string into a URL-safe slug.
 * Mirrors the private.normalize_slug() SQL function from migration 0005.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Validate a user-edited slug. Returns null if valid, else an error message.
 */
export function validateSlug(slug: string): string | null {
  if (!slug || slug.length === 0) return "URL handle is required";
  if (slug.length < 3) return "Must be at least 3 characters";
  if (slug.length > 60) return "Must be 60 characters or fewer";
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return "Use only lowercase letters, numbers, and hyphens";
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return "Cannot start or end with a hyphen";
  }
  if (/--/.test(slug)) {
    return "Cannot contain consecutive hyphens";
  }
  return null;
}
