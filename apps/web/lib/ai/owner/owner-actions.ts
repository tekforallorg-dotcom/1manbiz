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
import {
  resolveActiveProduct,
  fetchActiveVariants,
  matchVariant,
  type ResolvedVariant,
} from "@/lib/ai/actions/order-actions";
import type { OwnerActionDraft, OwnerChatTurn } from "@/lib/ai/owner/manage-reply";

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
  kind: "set_stock" | "set_price";
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
    kind: row.kind as "set_stock" | "set_price",
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

// Resolve the draft against the live catalog and store a proposal. The
// summary the owner confirms is composed from the RESOLVED entities, never
// from model text, so YES always executes exactly what was shown.
export async function proposeOwnerAction(
  admin: AdminClient,
  businessId: string,
  draft: OwnerActionDraft,
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

  // One pending proposal at a time: a new one supersedes anything older.
  await admin
    .from("owner_actions")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("status", "proposed");

  const { error } = await admin.from("owner_actions").insert({
    business_id: businessId,
    kind: draft.kind,
    payload,
    summary,
  });
  if (error) {
    console.error("[owner/actions] propose insert failed", error.message);
    return { ok: false, message: "I could not save that change. Try again shortly." };
  }
  return { ok: true, summary };
}

export type ExecuteResult =
  | { ok: true; summary: string }
  | { ok: false; message: string };

export async function executePendingAction(
  admin: AdminClient,
  businessId: string,
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
  } else {
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
  }

  await admin
    .from("owner_actions")
    .update({ status: "confirmed", resolved_at: new Date().toISOString() })
    .eq("id", pending.id);

  return { ok: true, summary: pending.summary };
}
