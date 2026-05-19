/**
 * Meta Graph API client for WhatsApp Business.
 *
 * Currently used for credential verification only. Will expand in slice
 * 3G.C to send outbound messages once we model conversations + messages.
 */

const GRAPH_BASE = "https://graph.facebook.com/v22.0";

export type VerifyPhoneNumberResult =
  | {
      ok: true;
      data: {
        display_phone_number: string;
        verified_name: string | null;
        whatsapp_business_account_id: string | null;
      };
    }
  | { ok: false; error: string };

/**
 * Verifies a WhatsApp phone number ID + access token by calling
 * GET /{phone-number-id}. Returns display_phone_number and verified_name
 * on success, friendly error string on failure.
 */
export async function verifyWhatsAppPhoneNumber(args: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<VerifyPhoneNumberResult> {
  const { phoneNumberId, accessToken } = args;

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "Phone number ID and access token are required." };
  }

  const url = GRAPH_BASE + "/" + encodeURIComponent(phoneNumberId) + "?fields=display_phone_number,verified_name,whatsapp_business_account";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[meta-client] phone verify failed", { status: response.status, body });
      let metaMessage = "Meta rejected the credentials (HTTP " + response.status + ").";
      try {
        const parsed = JSON.parse(body);
        if (parsed && parsed.error && parsed.error.message) {
          metaMessage = parsed.error.message as string;
        }
      } catch {
        // body wasn't JSON, fall through
      }
      return { ok: false, error: metaMessage };
    }

    const data = (await response.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      whatsapp_business_account?: { id?: string };
    };

    if (!data.display_phone_number) {
      return { ok: false, error: "Meta returned an unexpected response shape." };
    }

    return {
      ok: true,
      data: {
        display_phone_number: data.display_phone_number,
        verified_name: data.verified_name ?? null,
        whatsapp_business_account_id: data.whatsapp_business_account?.id ?? null,
      },
    };
  } catch (e) {
    console.error("[meta-client] phone verify exception", e);
    const message = e instanceof Error ? e.message : "Network error reaching Meta.";
    return { ok: false, error: message };
  }
}
