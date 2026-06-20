import { supabase } from "./supabase";
import type { ConnectorHealth } from "./connectors";

// Money connectors: per-business payment-rail connections that feed the Money
// ledger and let BizBot reconcile payments. This is the connection record only;
// the payments table stays the transaction ledger. No secrets live here -- API
// keys (Paystack-API mode, later) belong in a separate service-role-only store.

export type PaymentProvider =
  | "paystack"
  | "opay"
  | "moniepoint"
  | "kuda"
  | "flutterwave"
  | "bank";

export interface PaymentConnectorRow {
  id: string;
  provider: PaymentProvider;
  mode: "api" | "manual";
  status: string;
  displayLabel: string | null;
  accountRef: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

export interface ProviderMeta {
  provider: PaymentProvider;
  name: string;
  blurb: string;
  domain: string | null; // for the runtime brand logo lookup; null = generic rail
}

// Catalog rendered on the Connectors screen. Every rail shows whether or not a
// row exists yet. All connect via manual mode in this slice; Paystack-API
// auto-sync is a later slice.
export const PAYMENT_PROVIDERS: ProviderMeta[] = [
  { provider: "paystack", name: "Paystack", blurb: "Card and transfer payments", domain: "paystack.com" },
  { provider: "opay", name: "OPay", blurb: "Record OPay payments", domain: "opayweb.com" },
  { provider: "moniepoint", name: "Moniepoint", blurb: "Moniepoint POS and transfers", domain: "moniepoint.com" },
  { provider: "kuda", name: "Kuda", blurb: "Kuda business transfers", domain: "kuda.com" },
  { provider: "flutterwave", name: "Flutterwave", blurb: "Flutterwave settlements", domain: "flutterwave.com" },
  { provider: "bank", name: "Bank transfer", blurb: "Direct bank transfers", domain: null },
];

export async function getPaymentConnectors(businessId: string): Promise<PaymentConnectorRow[]> {
  const { data, error } = await supabase
    .from("payment_connectors")
    .select(
      "id, provider, mode, status, display_label, account_ref, last_sync_at, last_error, connected_at",
    )
    .eq("business_id", businessId);

  if (error) {
    console.error("[payment-connectors] list error:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    provider: r.provider as PaymentProvider,
    mode: r.mode as "api" | "manual",
    status: r.status as string,
    displayLabel: (r.display_label as string | null) ?? null,
    accountRef: (r.account_ref as string | null) ?? null,
    lastSyncAt: (r.last_sync_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    connectedAt: (r.connected_at as string | null) ?? null,
  }));
}

// Manual connect: upsert a connector for this provider (owner-gated by RLS).
// onConflict keeps it idempotent against the (business_id, provider) unique.
export async function connectPaymentManual(
  businessId: string,
  provider: PaymentProvider,
  label: string,
  accountRef: string,
): Promise<{ error?: string }> {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) return { error: "Please enter a name or label." };

  const { error } = await supabase.from("payment_connectors").upsert(
    {
      business_id: businessId,
      provider,
      mode: "manual",
      status: "manual",
      display_label: trimmedLabel,
      account_ref: accountRef.trim() || null,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "business_id,provider" },
  );

  if (error) {
    console.error("[payment-connectors] connect error:", error);
    return { error: error.message };
  }
  return {};
}

export async function disconnectPayment(connectorId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from("payment_connectors").delete().eq("id", connectorId);
  if (error) {
    console.error("[payment-connectors] disconnect error:", error);
    return { error: error.message };
  }
  return {};
}

// Maps a row to the shared connector-card health badge. null => not connected
// yet (the card renders a neutral "Not connected" pill).
export function paymentHealth(row: PaymentConnectorRow | null): ConnectorHealth | null {
  if (!row) return null;
  if (row.lastError) return { state: "error", label: "Needs attention", tone: "danger" };
  const s = row.status.toLowerCase();
  if (s === "manual" || s === "connected") {
    return { state: "connected", label: "Connected", tone: "success" };
  }
  if (s === "needs_reconnection") {
    return { state: "needs_reconnection", label: "Reconnect needed", tone: "warn" };
  }
  return null;
}

export interface ProviderInflow {
  totalKobo: number;
  count: number;
  lastAt: string | null;
}

// Inflow per rail from settled payments (status "success" only; "pending" are
// uncompleted links). Reduced client-side; volume is low today. When this grows
// it should move to a SQL aggregate (view/RPC).
export async function getInflowByProvider(
  businessId: string,
): Promise<Record<string, ProviderInflow>> {
  const { data, error } = await supabase
    .from("payments")
    .select("provider, amount_kobo, created_at")
    .eq("business_id", businessId)
    .eq("status", "success");
  if (error) {
    console.error("[payment-connectors] inflow error:", error);
    return {};
  }
  const out: Record<string, ProviderInflow> = {};
  for (const r of data ?? []) {
    const p = r.provider as string;
    const cur = out[p] ?? { totalKobo: 0, count: 0, lastAt: null };
    cur.totalKobo += Number(r.amount_kobo) || 0;
    cur.count += 1;
    const at = r.created_at as string;
    if (!cur.lastAt || at > cur.lastAt) cur.lastAt = at;
    out[p] = cur;
  }
  return out;
}
