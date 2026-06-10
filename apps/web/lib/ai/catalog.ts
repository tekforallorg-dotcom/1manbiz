import { createAdminClient } from "@/lib/supabase/admin";
import { formatNairaFromKobo } from "@/lib/format";
import type { ReplyCatalogProduct } from "@/lib/ai/draft-reply";

type ProductRow = { id: string; name: string; price_kobo: number; stock_quantity: number };
type OptionRow = { product_id: string; name: string };
type VariantRow = {
  product_id: string;
  label: string;
  price_kobo: number | null;
  stock_quantity: number;
};
type RawVariant = { label: string; price_kobo: number | null; stock_quantity: number };

/**
 * Builds the lean reply catalog for a business: active products with price and
 * stock, enriched with their option axes (e.g. Color, Storage) and sellable
 * variant rows (label, price, availability). Shared by the live auto-reply
 * brain and the dashboard draft-reply route so the two never drift, and reused
 * by the owner-mode management brain. A variant whose price is left null
 * (inherit) falls back to the product price. Returns [] on any load error so
 * the caller degrades gracefully rather than failing the reply.
 */
export async function buildReplyCatalog(
  businessId: string,
): Promise<ReplyCatalogProduct[]> {
  const admin = createAdminClient();

  const { data: prodRows, error: prodErr } = await admin
    .from("products")
    .select("id, name, price_kobo, stock_quantity")
    .eq("business_id", businessId)
    .eq("status", "active")
    .order("name", { ascending: true })
    .limit(200);
  if (prodErr || !prodRows) {
    if (prodErr) console.error("[ai/catalog] products load failed", prodErr);
    return [];
  }
  const products = prodRows as ProductRow[];
  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  const [{ data: optRows }, { data: varRows }] = await Promise.all([
    admin
      .from("product_options")
      .select("product_id, name, position")
      .in("product_id", productIds)
      .order("position", { ascending: true }),
    admin
      .from("product_variants")
      .select("product_id, label, price_kobo, stock_quantity, is_active")
      .in("product_id", productIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  const optionsByProduct = new Map<string, string[]>();
  for (const o of (optRows as OptionRow[] | null) ?? []) {
    const list = optionsByProduct.get(o.product_id) ?? [];
    list.push(o.name);
    optionsByProduct.set(o.product_id, list);
  }

  const variantsByProduct = new Map<string, RawVariant[]>();
  for (const v of (varRows as VariantRow[] | null) ?? []) {
    const list = variantsByProduct.get(v.product_id) ?? [];
    list.push({ label: v.label, price_kobo: v.price_kobo, stock_quantity: v.stock_quantity });
    variantsByProduct.set(v.product_id, list);
  }

  return products.map((p) => {
    const product: ReplyCatalogProduct = {
      name: p.name,
      price_naira: formatNairaFromKobo(Number(p.price_kobo)),
      in_stock: Number(p.stock_quantity) > 0,
    };
    const options = optionsByProduct.get(p.id);
    if (options && options.length > 0) product.options = options;
    const rawVariants = variantsByProduct.get(p.id);
    if (rawVariants && rawVariants.length > 0) {
      product.variants = rawVariants.map((v) => ({
        label: v.label,
        price_naira: formatNairaFromKobo(Number(v.price_kobo ?? p.price_kobo)),
        in_stock: Number(v.stock_quantity) > 0,
      }));
    }
    return product;
  });
}

/**
 * Renders the CATALOG prompt block shared by every brain (customer BizBot
 * today, the owner-mode management brain next). A product with options prints
 * its Options axes plus ONE compact Choices line: every active variant label
 * VERBATIM (the server matches order items against these exact labels), with
 * a price in parentheses only when it differs from the product price and an
 * "out of stock" mark when it cannot be sold. Keeps the model's grounding
 * short, exact, and cheap even at 16+ variants per product.
 */
export function renderCatalogBlock(catalog: ReplyCatalogProduct[]): string {
  if (catalog.length === 0) return "(no active products)";
  return catalog
    .map((p) => {
      let line =
        "- " + p.name + " | " + p.price_naira + " | " + (p.in_stock ? "in stock" : "out of stock");
      if (p.options && p.options.length > 0) {
        line += "\n  Options: " + p.options.join(", ");
      }
      if (p.variants && p.variants.length > 0) {
        const choices = p.variants
          .map((v) => {
            const notes: string[] = [];
            if (v.price_naira !== p.price_naira) notes.push(v.price_naira);
            if (!v.in_stock) notes.push("out of stock");
            return notes.length > 0 ? v.label + " (" + notes.join(", ") + ")" : v.label;
          })
          .join(", ");
        line += "\n  Choices: " + choices;
      }
      return line;
    })
    .join("\n");
}
