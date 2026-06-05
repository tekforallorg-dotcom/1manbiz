// Thin mobile client for the shared payment-init endpoint. Auth is the user's
// Supabase access token (Bearer); the server resolves the order, computes the
// amount in kobo, and handles idempotency - mobile never sends an amount.

import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";

const WEB_BASE = API_BASE_URL;

type InitResult =
  | { ok: true; authorizationUrl: string; reference: string; payUrl: string }
  | { ok: false; error: string };

export async function initPaymentLink(orderId: string): Promise<InitResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "You are not signed in." };

  let res: Response;
  try {
    res = await fetch(WEB_BASE + "/api/payments/init", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }

  let json: {
    ok?: boolean;
    authorization_url?: string;
    reference?: string;
    error?: string;
  };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Unexpected response from the server." };
  }

  if (!res.ok || !json.ok || !json.reference) {
    return { ok: false, error: json.error ?? "Could not create the payment link." };
  }

  return {
    ok: true,
    authorizationUrl: json.authorization_url ?? "",
    reference: json.reference,
    payUrl: WEB_BASE + "/pay/" + json.reference,
  };
}
