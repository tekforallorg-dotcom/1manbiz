import { supabase } from "./supabase";

export interface VariantOption {
  name: string;
  position: number;
  values: string[];
}

export interface VariantRow {
  id?: string;
  label: string;
  option1: string | null;
  option2: string | null;
  priceKobo: number;
  stockQuantity: number;
  isActive: boolean;
}

export interface VariantSetup {
  options: VariantOption[];
  variants: VariantRow[];
}

export const OPTION_PRESETS: { name: string; values: string[] }[] = [
  { name: "Size", values: ["S", "M", "L", "XL"] },
  { name: "Storage", values: ["128GB", "256GB", "512GB", "1TB"] },
  { name: "Color", values: ["Black", "White", "Blue", "Red"] },
];

// Aggregate variant count + total stock for a product, used to show the product
// total as variant-derived (read-only) on the product form.
export async function fetchVariantSummary(
  productId: string,
): Promise<{ count: number; totalStock: number }> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("stock_quantity")
    .eq("product_id", productId);
  if (error) {
    console.error("[variants] summary error:", error);
    return { count: 0, totalStock: 0 };
  }
  const rows = (data as any[]) ?? [];
  const totalStock = rows.reduce(
    (sum, r) => sum + ((r.stock_quantity as number) || 0),
    0,
  );
  return { count: rows.length, totalStock };
}

// Load saved options + variants for a product. Option values are derived from
// the distinct values present on the variants at each position (we do not store
// option values separately; the variants are the source of truth).
export async function fetchVariantSetup(productId: string): Promise<VariantSetup> {
  const [optRes, varRes] = await Promise.all([
    supabase
      .from("product_options")
      .select("name, position")
      .eq("product_id", productId)
      .order("position", { ascending: true }),
    supabase
      .from("product_variants")
      .select("id, label, option1, option2, price_kobo, stock_quantity, is_active")
      .eq("product_id", productId)
      .order("created_at", { ascending: true }),
  ]);

  const variants: VariantRow[] = ((varRes.data as any[]) ?? []).map((v) => ({
    id: v.id as string,
    label: v.label as string,
    option1: (v.option1 as string | null) ?? null,
    option2: (v.option2 as string | null) ?? null,
    priceKobo: (v.price_kobo as number | null) ?? 0,
    stockQuantity: (v.stock_quantity as number) ?? 0,
    isActive: (v.is_active as boolean) ?? true,
  }));

  const options: VariantOption[] = ((optRes.data as any[]) ?? []).map((o) => {
    const position = o.position as number;
    const seen = new Set<string>();
    const values: string[] = [];
    for (const v of variants) {
      const val = position === 1 ? v.option1 : v.option2;
      if (val && !seen.has(val)) {
        seen.add(val);
        values.push(val);
      }
    }
    return { name: o.name as string, position, values };
  });

  return { options, variants };
}

// Build the cartesian product of option values into variant rows, preserving
// id/stock/price/active from any existing variant with the same combination so
// edits and order links survive a regenerate. New combinations default to the
// product price.
export function generateVariants(
  options: VariantOption[],
  productPriceKobo: number,
  existing: VariantRow[],
): VariantRow[] {
  const active = options.filter((o) => o.values.length > 0).slice(0, 2);
  if (active.length === 0) return [];
  const axis1 = active[0]?.values ?? [];
  const hasAxis2 = active.length > 1;
  const axis2 = hasAxis2 ? (active[1]?.values ?? []) : [];

  const byCombo = new Map<string, VariantRow>();
  for (const v of existing) {
    byCombo.set((v.option1 ?? "") + "\u0000" + (v.option2 ?? ""), v);
  }

  const make = (option1: string, option2: string | null): VariantRow => {
    const prev = byCombo.get(option1 + "\u0000" + (option2 ?? ""));
    return {
      id: prev?.id,
      label: option2 ? option1 + " / " + option2 : option1,
      option1,
      option2,
      priceKobo: prev?.priceKobo ?? productPriceKobo,
      stockQuantity: prev?.stockQuantity ?? 0,
      isActive: prev?.isActive ?? true,
    };
  };

  const out: VariantRow[] = [];
  for (const v1 of axis1) {
    if (hasAxis2) {
      for (const v2 of axis2) out.push(make(v1, v2));
    } else {
      out.push(make(v1, null));
    }
  }
  return out;
}

// Persist options + variants for a product. Options are replaced wholesale
// (they are not FK-referenced). Variants are diffed by id: existing ids update,
// new rows insert, removed ids delete (order_items.variant_id is ON DELETE SET
// NULL and variant_label_snapshot preserves the receipt label). Best-effort
// sequential writes; returns the first error.
export async function saveVariantSetup(
  businessId: string,
  productId: string,
  setup: VariantSetup,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const delOpt = await supabase
    .from("product_options")
    .delete()
    .eq("product_id", productId);
  if (delOpt.error) return { ok: false, error: delOpt.error.message };

  const optRows = setup.options
    .filter((o) => o.values.length > 0)
    .slice(0, 2)
    .map((o, idx) => ({
      business_id: businessId,
      product_id: productId,
      name: o.name,
      position: idx + 1,
    }));
  if (optRows.length > 0) {
    const insOpt = await supabase.from("product_options").insert(optRows);
    if (insOpt.error) return { ok: false, error: insOpt.error.message };
  }

  const existing = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId);
  if (existing.error) return { ok: false, error: existing.error.message };
  const existingIds = new Set(((existing.data as any[]) ?? []).map((r) => r.id as string));
  const keepIds = new Set(setup.variants.filter((v) => v.id).map((v) => v.id as string));

  const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
  if (toDelete.length > 0) {
    const delVar = await supabase.from("product_variants").delete().in("id", toDelete);
    if (delVar.error) return { ok: false, error: delVar.error.message };
  }

  for (const v of setup.variants) {
    if (v.id) {
      const upd = await supabase
        .from("product_variants")
        .update({
          label: v.label,
          option1: v.option1,
          option2: v.option2,
          price_kobo: v.priceKobo,
          stock_quantity: v.stockQuantity,
          is_active: v.isActive,
        })
        .eq("id", v.id);
      if (upd.error) return { ok: false, error: upd.error.message };
    } else {
      const ins = await supabase.from("product_variants").insert({
        business_id: businessId,
        product_id: productId,
        label: v.label,
        option1: v.option1,
        option2: v.option2,
        price_kobo: v.priceKobo,
        stock_quantity: v.stockQuantity,
        is_active: v.isActive,
      });
      if (ins.error) return { ok: false, error: ins.error.message };
    }
  }

  // Keep the product total stock in sync with its variants. Variants are the
  // source of truth for stock once they exist; when none remain, leave the
  // product stock untouched so it reverts to manual management.
  if (setup.variants.length > 0) {
    const total = setup.variants.reduce(
      (sum, v) => sum + (v.stockQuantity || 0),
      0,
    );
    const updProd = await supabase
      .from("products")
      .update({ stock_quantity: total, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (updProd.error) return { ok: false, error: updProd.error.message };
  }

  return { ok: true };
}
