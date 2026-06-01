/**
 * @1manbiz/shared
 *
 * Shared TypeScript types and utilities consumed by apps/web and apps/mobile.
 * One source of truth for cross-app domain shapes so the two surfaces cannot
 * silently drift (e.g. an order source added on one app but not the other).
 */

// --- Order domain ---------------------------------------------------------

// Mirrors the DB CHECK constraints. Keep in lockstep with:
//   orders_source_check  (migration 0014)
//   orders_status_check
export type OrderSource = "manual" | "whatsapp" | "instagram" | "catalogue" | "whatsapp_ai";
export type OrderStatus = "pending" | "paid" | "cancelled";

// Human-facing label for each order source. Exhaustive over OrderSource, so
// adding a new source without a label is a compile error in both apps.
export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  manual: "Captured manually",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  catalogue: "Online catalogue",
  whatsapp_ai: "WhatsApp (AI draft)",
};

// --- AI order-draft proposal (3H.x) --------------------------------------

// Shape returned by POST /api/ai/parse-order. The server resolves name + price
// from the catalog; the client never sets money. Both apps consume this.
export interface ProposalLineItem {
  productId: string;
  name: string;
  qty: number;
  unitPriceKobo: number;
}

export interface CustomerHint {
  name: string | null;
  phone: string | null;
}

export interface OrderProposal {
  lineItems: ProposalLineItem[];
  customerHint: CustomerHint | null;
  notes: string;
  confidence: "high" | "low";
}
