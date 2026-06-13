"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseNairaInputToKobo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type CreateProductState = {
  error: string | null;
  fieldErrors?: Record<string, string>;
};

const VARIANT_MAX_STOCK = 1000000;

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
  const imagePathRaw = String(formData.get("image_path") ?? "").trim();
  const imagePath = imagePathRaw.length > 0 ? imagePathRaw : null;
  const hasVariants = String(formData.get("has_variants") ?? "") === "1";

  // Validate
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Product name is required";
  else if (name.length > 120) fieldErrors.name = "Name is too long (max 120 characters)";

  const priceKobo = parseNairaInputToKobo(priceInput);
  if (!priceInput) {
    fieldErrors.price_naira = "Price is required";
  } else if (priceKobo === 0 && priceInput !== "0") {
    fieldErrors.price_naira = "Enter a valid price";
  }

  // Single-axis variants (mirrors the WhatsApp add-product model): one option,
  // two or more values, each with its own stock. Variants inherit the base
  // price; product stock is the sum of the variant stocks.
  let optionName = "";
  let variantRows: { label: string; stock: number }[] = [];
  let stockQty = 0;

  if (hasVariants) {
    optionName = String(formData.get("option_name") ?? "").trim();
    if (!optionName) fieldErrors.option_name = "Name this option (e.g. Color)";
    else if (optionName.length > 40) fieldErrors.option_name = "Option name is too long (max 40)";

    let parsed: unknown = [];
    try {
      parsed = JSON.parse(String(formData.get("variants_json") ?? "[]"));
    } catch {
      parsed = [];
    }
    const cleaned = (Array.isArray(parsed) ? parsed : [])
      .map((r) => {
        const row = (r ?? {}) as Record<string, unknown>;
        return { label: String(row.label ?? "").trim(), stock: Number(row.stock ?? 0) };
      })
      .filter((r) => r.label.length > 0);

    const seen = new Set<string>();
    let duplicate = false;
    for (const r of cleaned) {
      const key = r.label.toLowerCase();
      if (seen.has(key)) duplicate = true;
      seen.add(key);
    }

    if (cleaned.length < 2) {
      fieldErrors.variants = "Add at least two values (for example Black and White).";
    } else if (duplicate) {
      fieldErrors.variants = "Option values must be unique.";
    } else if (cleaned.some((r) => r.label.length > 60)) {
      fieldErrors.variants = "An option value is too long (max 60 characters).";
    } else if (cleaned.some((r) => !Number.isInteger(r.stock) || r.stock < 0 || r.stock > VARIANT_MAX_STOCK)) {
      fieldErrors.variants = "Each value's stock must be a whole number from 0 to 1,000,000.";
    } else {
      variantRows = cleaned;
    }
  } else {
    const stockInput = String(formData.get("stock_quantity") ?? "0").trim();
    stockQty = Number.parseInt(stockInput, 10);
    if (Number.isNaN(stockQty) || stockQty < 0) {
      fieldErrors.stock_quantity = "Stock must be 0 or more";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  if (hasVariants) {
    // Insert product (stock = sum of variant stocks), then the option, then the
    // variants. RLS enforces owner scope on every table.
    const totalStock = variantRows.reduce((sum, r) => sum + r.stock, 0);
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .insert({
        business_id: business.id,
        name,
        sku,
        description,
        price_kobo: priceKobo,
        stock_quantity: totalStock,
        image_path: imagePath,
      })
      .select("id")
      .single();

    if (prodErr || !prod) {
      console.error("[inventory] insert product (with variants) failed", prodErr);
      return { error: `Failed to add product: ${prodErr?.message ?? "unknown error"}` };
    }
    const newProductId = (prod as { id: string }).id;

    const { error: optErr } = await supabase
      .from("product_options")
      .insert({ business_id: business.id, product_id: newProductId, name: optionName, position: 1 });
    if (optErr) {
      console.error("[inventory] insert product option failed", optErr);
      return { error: "Added the product, but its option did not save. You can add it from the product page." };
    }

    const { error: varErr } = await supabase.from("product_variants").insert(
      variantRows.map((r) => ({
        business_id: business.id,
        product_id: newProductId,
        label: r.label,
        option1: r.label,
        stock_quantity: r.stock,
        is_active: true,
      })),
    );
    if (varErr) {
      console.error("[inventory] insert product variants failed", varErr);
      return { error: "Added the product, but its variants did not save. You can add them from the product page." };
    }
  } else {
    // RLS enforces business_id ownership via products_insert_by_owner
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
  else if (name.length > 120) fieldErrors.name = "Name is too long (max 120 characters)";

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

export type VariantEditRow = {
  id: string;
  stockQuantity: number;
  priceKobo: number | null;
  isActive: boolean;
};

export type UpdateVariantsResult = { ok: boolean; error?: string };

const MAX_VARIANT_STOCK = 1000000;
const MAX_VARIANT_PRICE_KOBO = 10000000000;

// Edit existing variants (stock, price, active) and keep the product total
// stock equal to the sum of its variants. The product stock is read back from
// the database after the writes rather than trusting the client payload, which
// matches the invariant the WhatsApp add-product path enforces. Called directly
// from the client with a typed payload, not a form action.
export async function updateVariantsAction(input: {
  productId: string;
  rows: VariantEditRow[];
}): Promise<UpdateVariantsResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (businessError || !business) {
    console.error("[inventory] resolve business failed", businessError);
    return { ok: false, error: "No business found for this account." };
  }

  const productId = String(input.productId ?? "").trim();
  if (!productId) return { ok: false, error: "Missing product." };

  // Confirm the product belongs to this owner before touching its variants.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };

  const rows = Array.isArray(input.rows) ? input.rows : [];
  if (rows.length === 0) return { ok: false, error: "Nothing to save." };

  // Validate every row before writing anything.
  for (const r of rows) {
    if (!r.id) return { ok: false, error: "A variant is missing its id." };
    if (!Number.isInteger(r.stockQuantity) || r.stockQuantity < 0 || r.stockQuantity > MAX_VARIANT_STOCK) {
      return { ok: false, error: "Stock must be a whole number between 0 and " + MAX_VARIANT_STOCK + "." };
    }
    if (r.priceKobo !== null) {
      if (!Number.isInteger(r.priceKobo) || r.priceKobo < 0 || r.priceKobo > MAX_VARIANT_PRICE_KOBO) {
        return { ok: false, error: "A variant price is out of range." };
      }
    }
  }

  // Update each variant, scoped to this product and business.
  for (const r of rows) {
    const { error: updErr } = await supabase
      .from("product_variants")
      .update({
        stock_quantity: r.stockQuantity,
        price_kobo: r.priceKobo,
        is_active: r.isActive,
      })
      .eq("id", r.id)
      .eq("product_id", productId)
      .eq("business_id", business.id);
    if (updErr) {
      console.error("[inventory] update variant failed", updErr);
      return { ok: false, error: "Could not save a variant: " + updErr.message };
    }
  }

  // Keep the product total stock equal to the sum of its variants, read back
  // from the database rather than trusting the client payload.
  const { data: allVariants, error: sumErr } = await supabase
    .from("product_variants")
    .select("stock_quantity")
    .eq("product_id", productId)
    .eq("business_id", business.id);
  if (sumErr) {
    console.error("[inventory] re-read variants failed", sumErr);
    return { ok: false, error: "Saved variants but could not sync product stock." };
  }
  const variantsForSum = (allVariants ?? []) as { stock_quantity: number }[];
  const total = variantsForSum.reduce((sum, v) => sum + (v.stock_quantity ?? 0), 0);

  const { error: prodErr } = await supabase
    .from("products")
    .update({ stock_quantity: total, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("business_id", business.id);
  if (prodErr) {
    console.error("[inventory] sync product stock failed", prodErr);
    return { ok: false, error: "Saved variants but could not sync product stock." };
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/" + productId);
  return { ok: true };
}
