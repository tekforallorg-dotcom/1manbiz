// Thin mobile client for the owner-mode link-code endpoint. Auth is the user's
// Supabase access token (Bearer); the server generates a short-lived single-use
// code scoped to the caller's business. Mobile never invents the code.

import { supabase } from "./supabase";
import { API_BASE_URL } from "./config";

export type LinkCodeResult =
  | {
      ok: true;
      code: string;
      expiresAt: string | null;
      alreadyLinked: boolean;
      linkedPhone: string | null;
    }
  | { ok: false; error: string };

export async function generateOwnerLinkCode(): Promise<LinkCodeResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { ok: false, error: "You are not signed in." };

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + "/api/owner/link-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
  } catch {
    return { ok: false, error: "Network error. Check your connection and try again." };
  }

  let json: {
    ok?: boolean;
    code?: string;
    expires_at?: string | null;
    already_linked?: boolean;
    linked_phone?: string | null;
    error?: string;
  };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Unexpected response from the server." };
  }

  if (!res.ok || !json.ok || !json.code) {
    return { ok: false, error: json.error ?? "Could not generate a link code." };
  }
  return {
    ok: true,
    code: json.code,
    expiresAt: json.expires_at ?? null,
    alreadyLinked: !!json.already_linked,
    linkedPhone: json.linked_phone ?? null,
  };
}
