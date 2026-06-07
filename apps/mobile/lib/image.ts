import { supabase } from "./supabase";

// Resolves a product image path stored in DB to a public CDN URL.
// product-images is a public bucket (per migration 0004), so getPublicUrl
// is synchronous and never null when path is valid.
export function getProductImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl ?? null;
}

// Resolves a business logo path (business-logos is a public bucket) to a CDN URL.
export function getBusinessLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("business-logos").getPublicUrl(path);
  return data.publicUrl ?? null;
}
