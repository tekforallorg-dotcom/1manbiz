import { supabase } from "./supabase";
import type { MessageRow } from "./conversations";

const API_BASE = "https://1manbiz.vercel.app"; // TODO: move to EXPO_PUBLIC_API_BASE_URL.

export type SendReplyResult =
  | { ok: true; message: MessageRow }
  | { ok: false; error: string };

export async function sendReply(
  conversationId: string,
  body: string,
): Promise<SendReplyResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, error: "Not signed in" };
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + "/api/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify({ conversationId, body }),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Network error" };
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Fall through.
  }

  if (!res.ok || !json?.ok) {
    return { ok: false, error: json?.error ?? ("HTTP " + res.status) };
  }

  if (!json.message) {
    // Edge case: send succeeded on WhatsApp but DB insert failed server-side.
    // Return a minimal stand-in so UI can show something.
    return {
      ok: false,
      error: json.warning ?? "Sent but local copy missing",
    };
  }

  return { ok: true, message: json.message as MessageRow };
}
