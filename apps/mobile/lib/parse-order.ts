import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";
import type { OrderProposal } from "@1manbiz/shared";

export type { OrderProposal };

const API_BASE = API_BASE_URL;

export type ParseResult =
  | { ok: true; proposal: OrderProposal }
  | { ok: false; error: string };

// Calls the AI draft endpoint with the mobile Bearer pattern (identical to
// sendReply in lib/messages.ts). Read-only on the server: returns a proposal,
// writes nothing. The proposal shape lives in @1manbiz/shared so web + mobile
// cannot drift.
export async function parseOrderFromConversation(
  conversationId: string,
): Promise<ParseResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Not signed in" };
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + "/api/ai/parse-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({ conversationId }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  }

  let json: { ok?: boolean; proposal?: OrderProposal; error?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    // Fall through to the status-based error below.
  }

  if (!res.ok || !json?.ok || !json.proposal) {
    return { ok: false, error: json?.error ?? ("HTTP " + res.status) };
  }

  return { ok: true, proposal: json.proposal };
}
