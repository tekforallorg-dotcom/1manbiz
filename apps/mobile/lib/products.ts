import { supabase } from "./supabase";

export type ProductStatus = "active" | "archived";
export type ProductFilter = ProductStatus | "all";

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  price_kobo: number;
  stock_quantity: number;
  image_path: string | null;
  status: ProductStatus;
}

export async function fetchProducts(
  businessId: string,
  filter: ProductFilter = "all",
): Promise<Product[]> {
  let query = supabase
    .from("products")
    .select("id, name, sku, price_kobo, stock_quantity, image_path, status")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter !== "all") {
    query = query.eq("status", filter);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[products] fetch error:", error);
    return [];
  }
  return data as Product[];
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, price_kobo, stock_quantity, image_path, status")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[products] fetch one error:", error);
    return null;
  }
  return (data as Product | null) ?? null;
}

export interface ProductUpdate {
  name: string;
  price_kobo: number;
  stock_quantity: number;
  status: ProductStatus;
}

// Owner-scoped update. RLS policy products_update_by_owner enforces ownership
// and blocks business_id reassignment, so no extra server check is needed.
export async function updateProduct(
  id: string,
  patch: ProductUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase
    .from("products")
    .update({
      name: patch.name,
      price_kobo: patch.price_kobo,
      stock_quantity: patch.stock_quantity,
      status: patch.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[products] update error:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
