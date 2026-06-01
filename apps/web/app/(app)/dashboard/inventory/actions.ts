"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseNairaInputToKobo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type CreateProductState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function createProductAction(
  _prev: CreateProductState,
  formData: FormData,
): Promise<CreateProductState> {
  const supabase = await createClient();

  // Authn
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You need to be signed in." };
  }

  // Authz: resolve the business this user owns
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[inventory] resolve business failed", businessError);
    return { error: "No business found for this account." };
  }

  // Inputs
  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceInput = String(formData.get("price_naira") ?? "").trim();
  const stockInput = String(formData.get("stock_quantity") ?? "0").trim();
  const imagePathRaw = String(formData.get("image_path") ?? "").trim();
  const imagePath = imagePathRaw.length > 0 ? imagePathRaw : null;

  // Validate
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Product name is required";
  else if (name.length > 120)
    fieldErrors.name = "Name is too long (max 120 characters)";

  const priceKobo = parseNairaInputToKobo(priceInput);
  if (!priceInput) {
    fieldErrors.price_naira = "Price is required";
  } else if (priceKobo === 0 && priceInput !== "0") {
    fieldErrors.price_naira = "Enter a valid price";
  }

  const stockQty = Number.parseInt(stockInput, 10);
  if (Number.isNaN(stockQty) || stockQty < 0) {
    fieldErrors.stock_quantity = "Stock must be 0 or more";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // Insert (RLS enforces business_id ownership via products_insert_by_owner)
  const { error: insertError } = await supabase.from("products").insert({
    business_id: business.id,
    name,
    sku,
    description,
    price_kobo: priceKobo,
    stock_quantity: stockQty,
    image_path: imagePath,
  });

  if (insertError) {
    console.error("[inventory] insert product failed", insertError);
    return { error: `Failed to add product: ${insertError.message}` };
  }

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}

export type UpdateProductState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

export async function updateProductAction(
  _prev: UpdateProductState,
  formData: FormData,
): Promise<UpdateProductState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[inventory] resolve business failed", businessError);
    return { error: "No business found for this account." };
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing product id." };

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceInput = String(formData.get("price_naira") ?? "").trim();
  const stockInput = String(formData.get("stock_quantity") ?? "0").trim();
  const statusInput = String(formData.get("status") ?? "active").trim();
  const imagePathRaw = String(formData.get("image_path") ?? "").trim();
  const imagePath = imagePathRaw.length > 0 ? imagePathRaw : null;

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Product name is required";
  else if (name.length > 120)
    fieldErrors.name = "Name is too long (max 120 characters)";

  const priceKobo = parseNairaInputToKobo(priceInput);
  if (!priceInput) {
    fieldErrors.price_naira = "Price is required";
  } else if (priceKobo === 0 && priceInput !== "0") {
    fieldErrors.price_naira = "Enter a valid price";
  }

  const stockQty = Number.parseInt(stockInput, 10);
  if (Number.isNaN(stockQty) || stockQty < 0) {
    fieldErrors.stock_quantity = "Stock must be 0 or more";
  }

  const status = statusInput === "archived" ? "archived" : "active";

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  // RLS enforces ownership via products_update_by_owner; scope to business_id
  // as defence in depth.
  const { error: updateError } = await supabase
    .from("products")
    .update({
      name,
      sku,
      description,
      price_kobo: priceKobo,
      stock_quantity: stockQty,
      status,
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", business.id);

  if (updateError) {
    console.error("[inventory] update product failed", updateError);
    return { error: `Failed to save product: ${updateError.message}` };
  }

  revalidatePath("/dashboard/inventory");
  redirect("/dashboard/inventory");
}
