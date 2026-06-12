/**
 * Owner-mode chat history and write rail.
 *
 * owner_messages is the management conversation log (separate from the
 * customer CRM) and feeds the brain its short history. owner_actions is the
 * propose -> YES-confirm -> execute rail: the brain names a product, choice,
 * and value; the server resolves the live entities (reusing the exact same
 * matching the customer order rail uses), validates bounds, stores a proposal,
 * and only a fresh YES from the owner executes it. Variant stock writes keep
 * the product total equal to the sum of its variants.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { formatNairaFromKobo } from "@/lib/format";
import { sendReceiptForOrder } from "@/lib/receipt-send";
import {
  resolveActiveProduct,
  fetchActiveVariants,
  matchVariant,
  type ResolvedVariant,
} from "@/lib/ai/actions/order-actions";
import type { OwnerActionDraft, OwnerChatTurn, DraftVariant } from "@/lib/ai/owner/manage-reply";

type AdminClient = ReturnType<typeof createAdminClient>;

const PROPOSAL_TTL_MS = 15 * 60 * 1000;
const MAX_STOCK = 100000;
const MAX_PRICE_NAIRA = 100000000;

export async function storeOwnerMessage(
  admin: AdminClient,
  businessId: string,
  direction: "in" | "out",
  body: string,
): Promise<void> {
  const { error } = await admin.from("owner_messages").insert({
    business_id: businessId,
    direction,
    body: body.slice(0, 4000),
  });
  if (error) console.error("[owner/messages] insert failed", error.message);
}

export async function loadOwnerHistory(
  admin: AdminClient,
  businessId: string,
  limit = 10,
): Promise<OwnerChatTurn[]> {
  const { data } = await admin
    .from("owner_messages")
    .select("direction, body")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = ((data ?? []) as Array<Record<string, unknown>>).reverse();
  return rows.map((r) => ({
    direction: r.direction === "out" ? "out" : "in",
    body: String(r.body ?? ""),
  }));
}

export interface OwnerPendingAction {
  id: string;
  kind: OwnerActionDraft["kind"];
  payload: Record<string, unknown>;
  summary: string;
}

export async function findPendingAction(
  admin: AdminClient,
  businessId: string,
): Promise<OwnerPendingAction | null> {
  const { data } = await admin
    .from("owner_actions")
    .select("id, kind, payload, summary, created_at")
    .eq("business_id", businessId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const age = Date.now() - new Date(row.created_at as string).getTime();
  if (age > PROPOSAL_TTL_MS) {
    await admin
      .from("owner_actions")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", row.id as string);
    return null;
  }
  return {
    id: row.id as string,
    kind: row.kind as OwnerActionDraft["kind"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    summary: row.summary as string,
  };
}

export async function cancelPendingAction(
  admin: AdminClient,
  businessId: string,
): Promise<boolean> {
  const pending = await findPendingAction(admin, businessId);
  if (!pending) return false;
  await admin
    .from("owner_actions")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("id", pending.id);
  return true;
}

export type ProposeResult =
  | { ok: true; summary: string }
  | { ok: false; message: string };

const LINK_CODE_TTL_MS = 15 * 60 * 1000;

export type LinkCodeResult =
  | { ok: true; code: string; expiresAt: string }
  | { ok: false; message: string };

// Mint a short-lived, single-use owner link code (shown only inside the
// authenticated app). Unguessable, no ambiguous characters, prefixed so it
// reads as a code in chat. Consuming it on link nulls owner_link_code.
export async function generateLinkCode(
  admin: AdminClient,
  businessId: string,
): Promise<LinkCodeResult> {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  const code = "LB-" + body;
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
  const { error } = await admin
    .from("businesses")
    .update({ owner_link_code: code, owner_link_code_expires_at: expiresAt })
    .eq("id", businessId);
  if (error) {
    console.error("[owner/actions] link code update failed", error.message);
    return { ok: false, message: "Could not generate a link code." };
  }
  return { ok: true, code, expiresAt };
}

// Snap-to-restock: the vision layer resolved an exact catalog product (and
// maybe a variant); the owner's words carry the new total. We reuse the same
// proposal path so confirmation, bounds, and the sum-of-variants invariant are
// identical to a typed restock. A vision product with options but no usable
// quantity, or an ambiguous variant, falls back to a normal clarifying ask.
export async function proposeStockFromVision(
  admin: AdminClient,
  businessId: string,
  match: { product: string; variant?: string },
  value: number,
): Promise<ProposeResult> {
  const draft: OwnerActionDraft = match.variant
    ? { kind: "set_stock", product: match.product, variant: match.variant, value }
    : { kind: "set_stock", product: match.product, value };
  return proposeOwnerAction(admin, businessId, draft);
}

// ----- Photo-add product drafting -----
// A 'drafting' owner_actions row holds a partial new product across turns. It
// never executes; once name + price + stock are all known it is converted to a
// normal add_product proposal (carrying the uploaded image_path) for the YES.

export interface DraftProduct {
  id: string;
  imagePath: string | null;
  name: string | null;
  priceKobo: number | null;
  stock: number | null;
  axis: string | null;
  variants: DraftVariant[] | null;
}

const DRAFT_TTL_MS = 30 * 60 * 1000;

function readDraft(row: Record<string, unknown>): DraftProduct {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const rawVariants = Array.isArray(payload.variants) ? (payload.variants as unknown[]) : null;
  const variants = rawVariants
    ? (rawVariants
        .map((v) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null))
        .filter((v): v is Record<string, unknown> => v !== null)
        .map((v) => ({ label: String(v.label ?? ""), stock: Number(v.stock ?? 0) }))
        .filter((v) => v.label.length > 0) as DraftVariant[])
    : null;
  return {
    id: row.id as string,
    imagePath: (payload.image_path as string | undefined) ?? null,
    name: (payload.name as string | undefined) ?? null,
    priceKobo: typeof payload.price_kobo === "number" ? (payload.price_kobo as number) : null,
    stock: typeof payload.stock === "number" ? (payload.stock as number) : null,
    axis: (payload.axis as string | undefined) ?? null,
    variants: variants && variants.length >= 2 ? variants : null,
  };
}

export async function findDraftProduct(
  admin: AdminClient,
  businessId: string,
): Promise<DraftProduct | null> {
  const { data } = await admin
    .from("owner_actions")
    .select("id, payload, created_at")
    .eq("business_id", businessId)
    .eq("kind", "add_product")
    .eq("status", "drafting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const age = Date.now() - new Date(row.created_at as string).getTime();
  if (age > DRAFT_TTL_MS) {
    await admin
      .from("owner_actions")
      .update({ status: "expired", resolved_at: new Date().toISOString() })
      .eq("id", row.id as string);
    return null;
  }
  return readDraft(row);
}

// Start (or restart) a photo-add draft. Any older drafting or proposed row is
// retired first so there is never more than one thing in flight.
export async function startDraftProduct(
  admin: AdminClient,
  businessId: string,
  seed: { imagePath: string | null; name?: string | null },
): Promise<DraftProduct | null> {
  await admin
    .from("owner_actions")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .in("status", ["drafting", "proposed"]);
  const payload: Record<string, unknown> = {};
  if (seed.imagePath) payload.image_path = seed.imagePath;
  const cleanName = (seed.name ?? "").trim();
  if (cleanName.length >= 2 && cleanName.length <= 80) payload.name = cleanName;
  const { data, error } = await admin
    .from("owner_actions")
    .insert({ business_id: businessId, kind: "add_product", status: "drafting", payload, summary: "Drafting a new product" })
    .select("id, payload, created_at")
    .single();
  if (error || !data) {
    console.error("[owner/actions] start draft failed", error?.message);
    return null;
  }
  return readDraft(data as Record<string, unknown>);
}

// Merge newly-extracted fields into the drafting row. Values are validated and
// ignored when out of range so a stray number cannot poison the draft.
export async function fillDraftProduct(
  admin: AdminClient,
  draft: DraftProduct,
  fields: { name?: string | null; priceNaira?: number | null; stock?: number | null; axis?: string | null; variants?: DraftVariant[] | null },
): Promise<DraftProduct> {
  const payload: Record<string, unknown> = {};
  if (draft.imagePath) payload.image_path = draft.imagePath;
  let name = draft.name;
  let priceKobo = draft.priceKobo;
  let stock = draft.stock;
  let axis = draft.axis;
  let variants = draft.variants;

  const newName = (fields.name ?? "").trim();
  if (newName.length >= 2 && newName.length <= 80) name = newName;
  if (fields.priceNaira != null && fields.priceNaira >= 1 && fields.priceNaira <= MAX_PRICE_NAIRA) {
    priceKobo = Math.floor(fields.priceNaira) * 100;
  }
  if (fields.variants && fields.variants.length >= 2) {
    variants = fields.variants.map((v) => ({ label: v.label, stock: Math.floor(v.stock) }));
    axis = (fields.axis ?? draft.axis ?? "Option");
    // Product stock is the sum of the variants.
    stock = variants.reduce((sum, v) => sum + v.stock, 0);
  } else if (fields.stock != null && fields.stock >= 0 && fields.stock <= MAX_STOCK) {
    stock = Math.floor(fields.stock);
  }

  if (name) payload.name = name;
  if (priceKobo != null) payload.price_kobo = priceKobo;
  if (stock != null) payload.stock = stock;
  if (axis) payload.axis = axis;
  if (variants) payload.variants = variants;

  await admin.from("owner_actions").update({ payload }).eq("id", draft.id);
  return { id: draft.id, imagePath: draft.imagePath, name, priceKobo, stock, axis, variants };
}

export async function cancelDraftProduct(admin: AdminClient, businessId: string): Promise<void> {
  await admin
    .from("owner_actions")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("kind", "add_product")
    .eq("status", "drafting");
}

// Convert a complete draft into a real add_product proposal (image carried).
export async function proposeDraftProduct(
  admin: AdminClient,
  businessId: string,
  draft: DraftProduct,
): Promise<ProposeResult> {
  const hasVariants = draft.variants != null && draft.variants.length >= 2;
  if (!draft.name || draft.priceKobo == null || (!hasVariants && draft.stock == null)) {
    return { ok: false, message: "I still need the name, price, and stock for this product." };
  }
  await admin
    .from("owner_actions")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("id", draft.id);
  const proposeDraft: OwnerActionDraft = {
    kind: "add_product",
    name: draft.name,
    price: Math.floor(draft.priceKobo / 100),
    stock: draft.stock ?? (draft.variants ?? []).reduce((s, v) => s + v.stock, 0),
    ...(draft.imagePath ? { imagePath: draft.imagePath } : {}),
    ...(hasVariants ? { axis: draft.axis ?? "Option", variants: draft.variants ?? undefined } : {}),
  };
  return proposeOwnerAction(admin, businessId, proposeDraft);
}

// Dispatch the brain's draft to a per-kind proposer. Every proposer resolves
// live entities server-side, validates bounds, and stores a proposal whose
// summary is composed from the RESOLVED entities, never from model text, so
// YES always executes exactly what was shown.
export async function proposeOwnerAction(
  admin: AdminClient,
  businessId: string,
  draft: OwnerActionDraft,
): Promise<ProposeResult> {
  switch (draft.kind) {
    case "set_stock":
    case "set_price":
      return proposeStockOrPrice(admin, businessId, draft);
    case "add_product":
      return proposeAddProduct(admin, businessId, draft);
    case "set_product_active":
      return proposeProductActive(admin, businessId, draft);
    case "mark_order_paid":
    case "cancel_order":
      return proposeOrderStatus(admin, businessId, draft);
    case "set_policy":
      return proposePolicy(admin, businessId, draft);
  }
}

// One pending proposal at a time: a new one supersedes anything older.
async function storeProposal(
  admin: AdminClient,
  businessId: string,
  kind: OwnerActionDraft["kind"],
  payload: Record<string, unknown>,
  summary: string,
): Promise<ProposeResult> {
  await admin
    .from("owner_actions")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("status", "proposed");
  const { error } = await admin.from("owner_actions").insert({
    business_id: businessId,
    kind,
    payload,
    summary,
  });
  if (error) {
    console.error("[owner/actions] propose insert failed", error.message);
    return { ok: false, message: "I could not save that change. Try again shortly." };
  }
  return { ok: true, summary };
}

async function proposeAddProduct(
  admin: AdminClient,
  businessId: string,
  draft: Extract<OwnerActionDraft, { kind: "add_product" }>,
): Promise<ProposeResult> {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, message: "Give the product a name between 2 and 80 characters." };
  }
  if (draft.price < 1 || draft.price > MAX_PRICE_NAIRA) {
    return { ok: false, message: "Price must be between NGN 1 and NGN " + String(MAX_PRICE_NAIRA) + "." };
  }
  if (draft.stock < 0 || draft.stock > MAX_STOCK) {
    return { ok: false, message: "Stock must be between 0 and " + String(MAX_STOCK) + "." };
  }
  const { data: existing } = await admin
    .from("products")
    .select("id, name, status")
    .eq("business_id", businessId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (existing) {
    const row = existing as Record<string, unknown>;
    return {
      ok: false,
      message:
        row.status === "active"
          ? String(row.name) + " is already in the catalog. Did you mean to restock or change its price?"
          : String(row.name) + " exists but is hidden. Say 'show " + String(row.name) + " again' to bring it back.",
    };
  }
  const variants = draft.variants && draft.variants.length >= 2 ? draft.variants : null;
  const totalStock = variants ? variants.reduce((s, v) => s + v.stock, 0) : draft.stock;
  const payload: Record<string, unknown> = { name, price_kobo: draft.price * 100, stock: totalStock };
  if (draft.imagePath) payload.image_path = draft.imagePath;
  if (variants) {
    payload.axis = draft.axis ?? "Option";
    payload.variants = variants.map((v) => ({ label: v.label, stock: v.stock }));
  }
  const variantSummary = variants
    ? " in " + variants.map((v) => v.label + " (" + String(v.stock) + ")").join(", ")
    : " with " + String(totalStock) + " in stock";
  return storeProposal(
    admin,
    businessId,
    draft.kind,
    payload,
    "Add product " + name + " at " + formatNairaFromKobo(draft.price * 100) + variantSummary +
      (draft.imagePath ? ", with the photo you sent" : ""),
  );
}

async function proposeProductActive(
  admin: AdminClient,
  businessId: string,
  draft: Extract<OwnerActionDraft, { kind: "set_product_active" }>,
): Promise<ProposeResult> {
  const wanted = draft.product.trim();
  // Any-status lookup (the customer rail only sees active products): exact
  // name first, then a contains match if it is unambiguous.
  let { data: rows } = await admin
    .from("products")
    .select("id, name, status")
    .eq("business_id", businessId)
    .ilike("name", wanted)
    .limit(2);
  if (!rows || rows.length === 0) {
    const res = await admin
      .from("products")
      .select("id, name, status")
      .eq("business_id", businessId)
      .ilike("name", "%" + wanted + "%")
      .limit(2);
    rows = res.data;
  }
  const list = (rows ?? []) as Array<Record<string, unknown>>;
  if (list.length === 0) {
    return { ok: false, message: "I could not find " + wanted + " among your products." };
  }
  if (list.length > 1) {
    return {
      ok: false,
      message:
        "More than one product matches " + wanted + ": " +
        list.map((r) => String(r.name)).join(", ") + ". Use the exact name.",
    };
  }
  const found = list[0] as Record<string, unknown>;
  const isActive = found.status === "active";
  if (draft.active === isActive) {
    return {
      ok: false,
      message: String(found.name) + (isActive ? " is already live in the catalog." : " is already hidden."),
    };
  }
  return storeProposal(
    admin,
    businessId,
    draft.kind,
    { product_id: found.id as string, name: String(found.name), active: draft.active },
    draft.active
      ? "Show " + String(found.name) + " in the catalog again"
      : "Hide " + String(found.name) + " from the catalog (stock and history are kept)",
  );
}

async function proposeOrderStatus(
  admin: AdminClient,
  businessId: string,
  draft: Extract<OwnerActionDraft, { kind: "mark_order_paid" | "cancel_order" }>,
): Promise<ProposeResult> {
  const ref = draft.order.replace(/^#/, "").trim().toLowerCase();
  if (ref.length < 3 || ref.length > 8) {
    return { ok: false, message: "Use the order ref shown in the blocks, like #9F3C." };
  }
  const { data } = await admin
    .from("orders")
    .select("id, status, subtotal_kobo, customer_id")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = (data ?? []) as Array<Record<string, unknown>>;
  const matches = orders.filter((o) => String(o.id).toLowerCase().endsWith(ref));
  if (matches.length === 0) {
    return { ok: false, message: "I could not find order #" + ref.toUpperCase() + ". PENDING ORDERS and RECENT ORDERS show the refs." };
  }
  if (matches.length > 1) {
    return { ok: false, message: "More than one recent order matches #" + ref.toUpperCase() + ". Ask me for recent orders and use a longer ref." };
  }
  const order = matches[0] as Record<string, unknown>;
  const status = String(order.status);
  const refLabel = "#" + String(order.id).slice(-4).toUpperCase();
  if (draft.kind === "mark_order_paid") {
    if (status === "paid") return { ok: false, message: "Order " + refLabel + " is already paid." };
    if (status === "cancelled") return { ok: false, message: "Order " + refLabel + " was cancelled; it cannot be marked paid." };
  } else if (status === "cancelled") {
    return { ok: false, message: "Order " + refLabel + " is already cancelled." };
  }
  let who = "";
  if (order.customer_id) {
    const { data: cust } = await admin
      .from("customers")
      .select("name")
      .eq("id", order.customer_id as string)
      .maybeSingle();
    who = (((cust ?? {}) as Record<string, unknown>).name as string | null) ?? "";
  }
  const amount = formatNairaFromKobo(Number(order.subtotal_kobo));
  const tail = amount + (who ? ", " + who : "");
  return storeProposal(
    admin,
    businessId,
    draft.kind,
    { order_id: order.id as string, ref: refLabel },
    draft.kind === "mark_order_paid"
      ? "Mark order " + refLabel + " (" + tail + ") as paid"
      : "Cancel order " + refLabel + " (" + tail + ")" + (status === "paid" ? " and restore its stock" : ""),
  );
}

async function proposePolicy(
  admin: AdminClient,
  businessId: string,
  draft: Extract<OwnerActionDraft, { kind: "set_policy" }>,
): Promise<ProposeResult> {
  const title = draft.title.trim();
  const content = draft.content.trim();
  if (title.length < 2 || title.length > 60) {
    return { ok: false, message: "Give the policy a short title (2 to 60 characters)." };
  }
  if (content.length < 5 || content.length > 1000) {
    return { ok: false, message: "The policy text must be 5 to 1000 characters." };
  }
  const preview = content.length > 80 ? content.slice(0, 77) + "..." : content;
  return storeProposal(
    admin,
    businessId,
    draft.kind,
    { title, content },
    "Save shop policy '" + title + "': " + preview,
  );
}

type StockPriceDraft = Extract<OwnerActionDraft, { kind: "set_stock" | "set_price" }>;

// Stock and price changes resolve through the exact same matching the
// customer order rail uses, so the two can never disagree about the catalog.
async function proposeStockOrPrice(
  admin: AdminClient,
  businessId: string,
  draft: StockPriceDraft,
): Promise<ProposeResult> {
  const product = await resolveActiveProduct(admin, businessId, draft.product);
  if (!product) {
    return { ok: false, message: "I could not find " + draft.product + " in the catalog. Use the exact product name." };
  }

  const variants = await fetchActiveVariants(admin, product.id, product.price_kobo);
  let variant: ResolvedVariant | null = null;
  if (variants.length > 0) {
    variant = draft.variant ? matchVariant(variants, draft.variant) : null;
    if (!variant && draft.kind === "set_stock") {
      return {
        ok: false,
        message:
          product.name + " has options, so set the stock per choice. Choices: " +
          variants.map((v) => v.label).join(", ") + ". Which one?",
      };
    }
    if (!variant && draft.kind === "set_price" && draft.variant) {
      return {
        ok: false,
        message:
          "I could not find the choice " + draft.variant + " on " + product.name +
          ". Choices: " + variants.map((v) => v.label).join(", ") + ".",
      };
    }
  }

  const value = Math.floor(draft.value);
  let summary = "";
  const payload: Record<string, unknown> = {
    product_id: product.id,
    product_name: product.name,
  };

  if (draft.kind === "set_stock") {
    if (value < 0 || value > MAX_STOCK) {
      return { ok: false, message: "Stock must be between 0 and " + String(MAX_STOCK) + "." };
    }
    payload.value = value;
    if (variant) {
      payload.variant_id = variant.id;
      payload.variant_label = variant.label;
      summary = "Set " + product.name + " - " + variant.label + " stock to " + String(value);
    } else {
      summary = "Set " + product.name + " stock to " + String(value);
    }
  } else {
    if (value < 1 || value > MAX_PRICE_NAIRA) {
      return { ok: false, message: "Price must be between NGN 1 and NGN " + String(MAX_PRICE_NAIRA) + "." };
    }
    payload.value_kobo = value * 100;
    if (variant) {
      payload.variant_id = variant.id;
      payload.variant_label = variant.label;
      summary = "Set " + product.name + " - " + variant.label + " price to " + formatNairaFromKobo(value * 100);
    } else {
      summary = "Set " + product.name + " price to " + formatNairaFromKobo(value * 100);
    }
  }

  return storeProposal(admin, businessId, draft.kind, payload, summary);
}

export type ExecuteResult =
  | { ok: true; summary: string }
  | { ok: false; message: string };

export async function executePendingAction(
  admin: AdminClient,
  businessId: string,
  opts: { origin?: string } = {},
): Promise<ExecuteResult | null> {
  const pending = await findPendingAction(admin, businessId);
  if (!pending) return null;

  const productId = pending.payload.product_id as string;
  const variantId = (pending.payload.variant_id as string | undefined) ?? null;

  if (pending.kind === "set_stock") {
    const value = Number(pending.payload.value);
    if (variantId) {
      const { error } = await admin
        .from("product_variants")
        .update({ stock_quantity: value })
        .eq("id", variantId);
      if (error) return { ok: false, message: "Stock update failed. Try again shortly." };
      // Keep the invariant: product stock equals the sum of its variants.
      const { data: vrows } = await admin
        .from("product_variants")
        .select("stock_quantity")
        .eq("product_id", productId);
      const total = ((vrows ?? []) as Array<Record<string, unknown>>).reduce(
        (sum, r) => sum + Number(r.stock_quantity ?? 0),
        0,
      );
      await admin.from("products").update({ stock_quantity: total }).eq("id", productId);
    } else {
      const { error } = await admin
        .from("products")
        .update({ stock_quantity: value })
        .eq("id", productId);
      if (error) return { ok: false, message: "Stock update failed. Try again shortly." };
    }
  } else if (pending.kind === "set_price") {
    const valueKobo = Number(pending.payload.value_kobo);
    if (variantId) {
      const { error } = await admin
        .from("product_variants")
        .update({ price_kobo: valueKobo })
        .eq("id", variantId);
      if (error) return { ok: false, message: "Price update failed. Try again shortly." };
    } else {
      const { error } = await admin
        .from("products")
        .update({ price_kobo: valueKobo })
        .eq("id", productId);
      if (error) return { ok: false, message: "Price update failed. Try again shortly." };
    }
  } else if (pending.kind === "add_product") {
    const insertRow: Record<string, unknown> = {
      business_id: businessId,
      name: pending.payload.name as string,
      price_kobo: Number(pending.payload.price_kobo),
      stock_quantity: Number(pending.payload.stock),
      status: "active",
    };
    if (pending.payload.image_path) insertRow.image_path = pending.payload.image_path as string;
    const rawVariants = Array.isArray(pending.payload.variants)
      ? (pending.payload.variants as Array<Record<string, unknown>>)
      : null;
    if (rawVariants && rawVariants.length >= 2) {
      const { data: prod, error: prodErr } = await admin
        .from("products")
        .insert(insertRow)
        .select("id")
        .single();
      if (prodErr || !prod) return { ok: false, message: "Could not add the product. Try again shortly." };
      const newProductId = (prod as Record<string, unknown>).id as string;
      const axis = (pending.payload.axis as string | undefined) ?? "Option";
      const { error: optErr } = await admin
        .from("product_options")
        .insert({ business_id: businessId, product_id: newProductId, name: axis, position: 0 });
      if (optErr) return { ok: false, message: "Added the product, but its options did not save. Edit it in the app." };
      const variantRows = rawVariants.map((v) => ({
        business_id: businessId,
        product_id: newProductId,
        label: String(v.label ?? ""),
        option1: String(v.label ?? ""),
        stock_quantity: Number(v.stock ?? 0),
        is_active: true,
      }));
      const { error: varErr } = await admin.from("product_variants").insert(variantRows);
      if (varErr) return { ok: false, message: "Added the product, but its variants did not save. Edit it in the app." };
    } else {
      const { error } = await admin.from("products").insert(insertRow);
      if (error) return { ok: false, message: "Could not add the product. Try again shortly." };
    }
  } else if (pending.kind === "set_product_active") {
    const { error } = await admin
      .from("products")
      .update({ status: pending.payload.active ? "active" : "archived" })
      .eq("id", pending.payload.product_id as string)
      .eq("business_id", businessId);
    if (error) return { ok: false, message: "Could not update the product. Try again shortly." };
  } else if (pending.kind === "mark_order_paid" || pending.kind === "cancel_order") {
    const orderId = pending.payload.order_id as string;
    const { data: orderRow } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .eq("business_id", businessId)
      .maybeSingle();
    const status = (((orderRow ?? {}) as Record<string, unknown>).status as string | undefined) ?? "";
    if (!status) return { ok: false, message: "That order no longer exists." };
    if (pending.kind === "mark_order_paid") {
      if (status === "cancelled") return { ok: false, message: "That order was cancelled; it cannot be marked paid." };
      if (status !== "paid") {
        const { error } = await admin
          .from("orders")
          .update({ status: "paid" })
          .eq("id", orderId)
          .eq("business_id", businessId);
        if (error) return { ok: false, message: "Could not mark the order paid. Try again shortly." };
      }
      // Best-effort receipt, exactly like the dashboard Mark paid. The paid
      // status is committed; never fail on the messaging side effect.
      try {
        await sendReceiptForOrder(admin, { orderId, origin: opts.origin ?? "https://1manbiz.vercel.app" });
      } catch (e) {
        console.error("[owner/actions] receipt auto-send threw", e);
      }
    } else if (status !== "cancelled") {
      const { error } = await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("business_id", businessId);
      if (error) return { ok: false, message: "Could not cancel the order. Try again shortly." };
    }
  } else if (pending.kind === "set_policy") {
    const title = pending.payload.title as string;
    const content = pending.payload.content as string;
    const { data: existing } = await admin
      .from("knowledge_items")
      .select("id")
      .eq("business_id", businessId)
      .ilike("title", title)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { error } = await admin
        .from("knowledge_items")
        .update({ content, status: "active" })
        .eq("id", (existing as Record<string, unknown>).id as string);
      if (error) return { ok: false, message: "Could not save the policy. Try again shortly." };
    } else {
      const { error } = await admin.from("knowledge_items").insert({
        business_id: businessId,
        title,
        content,
        source_type: "manual",
        status: "active",
      });
      if (error) return { ok: false, message: "Could not save the policy. Try again shortly." };
    }
  }

  await admin
    .from("owner_actions")
    .update({ status: "confirmed", resolved_at: new Date().toISOString() })
    .eq("id", pending.id);

  return { ok: true, summary: pending.summary };
}
