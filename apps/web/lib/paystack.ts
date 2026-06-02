/**
 * Paystack server helper. Reads PAYSTACK_SECRET_KEY from env and throws loudly
 * at call time if missing, so misconfiguration is obvious rather than silent.
 *
 * SERVER ONLY. The secret key must never reach a client bundle. Mobile triggers
 * payment by calling our own /api/payments/init with a Bearer token; it never
 * talks to Paystack directly.
 */

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not set");
  return key;
}

export type InitializeInput = {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
};

export type InitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; error: string; status: number };

/**
 * Initialize a Paystack transaction (hosted checkout). Amount is in kobo and is
 * passed straight through to Paystack, which also works in kobo for NGN.
 */
export async function initializeTransaction(
  input: InitializeInput,
): Promise<InitializeResult> {
  let res: Response;
  try {
    res = await fetch(PAYSTACK_BASE + "/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secretKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: "Could not reach Paystack: " + (err instanceof Error ? err.message : "network error"),
      status: 502,
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: "Paystack returned a non-JSON response", status: 502 };
  }

  const b = body as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string; access_code?: string; reference?: string };
  };

  if (!res.ok || !b.status || !b.data?.authorization_url) {
    return {
      ok: false,
      error: b.message ?? "Paystack initialize failed",
      status: res.status || 502,
    };
  }

  return {
    ok: true,
    authorizationUrl: b.data.authorization_url,
    accessCode: b.data.access_code ?? "",
    reference: b.data.reference ?? input.reference,
  };
}
