import { supabase } from "./supabase";

// Connector read layer. Only non-sensitive columns are ever selected from
// channel_accounts; the access_token column is deliberately never read so a
// provider token cannot reach the client (Feature Bible CHN-004: tokens stay
// server-side). The card UI is driven entirely by the projection below.

export interface ChannelConnector {
  id: string;
  channel: string;
  status: string;
  displayNumber: string | null;
  tokenType: string;
  tokenExpiresAt: string | null;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export type ConnectorTone = "success" | "warn" | "danger" | "muted";

export interface ConnectorHealth {
  state: "connected" | "needs_reconnection" | "disconnected" | "error" | "unknown";
  label: string;
  tone: ConnectorTone;
}

export async function getChannelConnectors(businessId: string): Promise<ChannelConnector[]> {
  const { data, error } = await supabase
    .from("channel_accounts")
    .select(
      "id, channel, status, meta_display_phone_number, token_type, token_expires_at, last_verified_at, last_error, created_at",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[connectors] list error:", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    channel: r.channel as string,
    status: r.status as string,
    displayNumber: (r.meta_display_phone_number as string | null) ?? null,
    tokenType: r.token_type as string,
    tokenExpiresAt: (r.token_expires_at as string | null) ?? null,
    lastVerifiedAt: (r.last_verified_at as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

// Derives a friendly health badge from raw row fields. A permanent token never
// triggers a reconnection prompt even when an expiry timestamp is set in the
// past (Meta permanent tokens carry a stale exp we must ignore).
export function connectorHealth(c: ChannelConnector): ConnectorHealth {
  if (c.lastError) {
    return { state: "error", label: "Needs attention", tone: "danger" };
  }
  const s = c.status.toLowerCase();
  if (s === "disconnected" || s === "revoked") {
    return { state: "disconnected", label: "Disconnected", tone: "muted" };
  }
  if (s === "connected") {
    const expired =
      c.tokenType !== "permanent" &&
      c.tokenExpiresAt !== null &&
      new Date(c.tokenExpiresAt).getTime() < Date.now();
    if (expired) {
      return { state: "needs_reconnection", label: "Reconnect needed", tone: "warn" };
    }
    return { state: "connected", label: "Connected", tone: "success" };
  }
  if (s === "pending" || s === "connecting") {
    return { state: "unknown", label: "Connecting", tone: "warn" };
  }
  const label = c.status.charAt(0).toUpperCase() + c.status.slice(1);
  return { state: "unknown", label, tone: "muted" };
}

// Compact relative time for the "verified Xh ago" meta line.
export function relativeShort(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Date.now() - then;
  if (diff < 60000) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// Owner-gated soft connect/disconnect. RLS (channel_accounts_update_by_owner ->
// private.is_business_owner) ensures only the business owner can flip status, and
// we only ever write status + updated_at (never the token). auto-reply.ts gates
// on status === "connected", so disconnecting genuinely pauses BizBot; the token
// is retained so a soft reconnect just resumes. A genuinely errored/expired
// connection needs the real Meta handshake on web, not this flip.
export async function setChannelConnection(
  channelAccountId: string,
  connected: boolean,
): Promise<{ status?: string; error?: string }> {
  const status = connected ? "connected" : "disconnected";
  const { data, error } = await supabase
    .from("channel_accounts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", channelAccountId)
    .select("status")
    .single();

  if (error) {
    console.error("[connectors] set connection error:", error);
    return { error: error.message };
  }
  return { status: (data?.status as string | undefined) ?? status };
}
