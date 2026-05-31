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
