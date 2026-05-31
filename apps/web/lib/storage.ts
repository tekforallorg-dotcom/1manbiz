/**
 * Storage helpers for the product-images bucket.
 * Bucket is public, so URLs are deterministic and CDN-cacheable.
 */

export function getProductImageUrl(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

export function getBusinessLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) return null;
  return baseUrl + "/storage/v1/object/public/business-logos/" + path;
}
