"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type CreateOrderState = {
  status: "idle" | "success" | "error";
  error: string | null;
  fieldErrors?: Record<string, string>;
};

type SubmittedItem = { product_id: string; quantity: number };

export async function createOrderAction(
  _prev: CreateOrderState,
  formData: FormData
): Promise<CreateOrderState> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { status: "error", error: "You need to be signed in." };
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[orders] resolve business failed", businessError);
    return { status: "error", error: "No business found for this account." };
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "[]");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const fieldErrors: Record<string, string> = {};

  if (!customerId) {
    fieldErrors.customer_id = "Pick a customer";
  }

  let submittedItems: SubmittedItem[] = [];
  try {
    const parsed = JSON.parse(itemsRaw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    submittedItems = parsed
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        product_id: String(it.product_id ?? ""),
        quantity: Math.max(1, Math.floor(Number(it.quantity ?? 0))),
      }))
      .filter((it) => it.product_id && it.quantity > 0);
  } catch (e) {
    console.error("[orders] items JSON parse failed", e);
    fieldErrors.items = "Could not read order items";
  }

  if (submittedItems.length === 0 && !fieldErrors.items) {
    fieldErrors.items = "Add at least one item";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  // Verify customer belongs to this business
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("business_id", business.id)
    .maybeSingle();

  if (!customer) {
    return {
      status: "error",
      error: "Customer not found.",
      fieldErrors: { customer_id: "Pick a valid customer" },
    };
  }

  // Fetch authoritative product prices (don't trust client-submitted amounts)
  const productIds = submittedItems.map((it) => it.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price_kobo, status")
    .eq("business_id", business.id)
    .in("id", productIds);

  if (productsError || !products) {
    console.error("[orders] product fetch failed", productsError);
    return { status: "error", error: "Could not load products." };
  }

  const productsById = new Map(products.map((p) => [p.id, p]));

  const missingProducts = submittedItems.filter((it) => !productsById.has(it.product_id));
  if (missingProducts.length > 0) {
    return {
      status: "error",
      error: "Some products are no longer available.",
      fieldErrors: { items: "Re-pick the unavailable items" },
    };
  }

  // Compute line totals + subtotal server-side
  let subtotalKobo = 0;
  const orderItemsToInsert: Array<{
    product_id: string;
    name_snapshot: string;
    price_kobo_snapshot: number;
    quantity: number;
    line_total_kobo: number;
  }> = [];

  for (const it of submittedItems) {
    const product = productsById.get(it.product_id);
    if (!product) continue;
    const lineTotal = product.price_kobo * it.quantity;
    subtotalKobo += lineTotal;
    orderItemsToInsert.push({
      product_id: product.id,
      name_snapshot: product.name,
      price_kobo_snapshot: product.price_kobo,
      quantity: it.quantity,
      line_total_kobo: lineTotal,
    });
  }

  // Insert order
  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      business_id: business.id,
      customer_id: customer.id,
      source: "manual",
      status: "pending",
      subtotal_kobo: subtotalKobo,
      currency: "NGN",
      notes,
    })
    .select("id")
    .single();

  if (orderError || !orderRow) {
    console.error("[orders] insert order failed", orderError);
    return { status: "error", error: "Could not create order: " + (orderError?.message ?? "unknown") };
  }

  // Insert order_items
  const rowsWithOrderId = orderItemsToInsert.map((row) => ({ ...row, order_id: orderRow.id }));
  const { error: itemsInsertError } = await supabase.from("order_items").insert(rowsWithOrderId);

  if (itemsInsertError) {
    console.error("[orders] insert order_items failed", itemsInsertError);
    // Roll back the order so we don't leave an orphan with subtotal but no items
    await supabase.from("orders").delete().eq("id", orderRow.id);
    return { status: "error", error: "Could not save order items: " + itemsInsertError.message };
  }

  revalidatePath("/dashboard/orders");
  redirect("/dashboard/orders");
}
