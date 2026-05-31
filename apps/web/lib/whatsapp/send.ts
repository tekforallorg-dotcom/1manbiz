/**
 * WhatsApp Cloud API send helper. Server-only.
 *
 * Posts a freeform text message to Meta's Graph API on behalf of a connected
 * business phone number. The access_token is the long-lived token previously
 * stored in channel_accounts during the Connect flow.
 *
 * Returns a discriminated union so the caller can branch on success/failure
 * without prying into HTTP-shaped responses.
 */

const META_GRAPH_VERSION = "v22.0";

type MetaTextResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

export type SendResult =
  | { ok: true; wamid: string }
  | { ok: false; error: string; status?: number };

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  toE164: string;
  body: string;
}): Promise<SendResult> {
  const { phoneNumberId, accessToken, toE164, body } = params;

  // Meta wants the recipient WITHOUT the leading +.
  const to = toE164.startsWith("+") ? toE164.slice(1) : toE164;
  const url = "https://graph.facebook.com/" + META_GRAPH_VERSION + "/" + phoneNumberId + "/messages";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body, preview_url: false },
      }),
    });
  } catch (e) {
    console.error("[whatsapp/send] network error", e);
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: msg };
  }

  let json: MetaTextResponse | null = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response, fall through with no parsed body.
  }

  if (!res.ok) {
    const metaError = json?.error?.message ?? ("Meta API error " + res.status);
    console.error("[whatsapp/send] non-2xx", { status: res.status, json });
    return { ok: false, error: metaError, status: res.status };
  }

  const wamid: string | undefined = json?.messages?.[0]?.id;
  if (!wamid) {
    console.error("[whatsapp/send] no wamid in response", json);
    return { ok: false, error: "Meta returned no message id" };
  }

  return { ok: true, wamid };
}
