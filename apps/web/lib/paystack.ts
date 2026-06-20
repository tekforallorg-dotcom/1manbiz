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

// ---------------------------------------------------------------------------
// Subaccounts: per-vendor split settlement.
//
// The platform stays the Paystack merchant. Each vendor is a subaccount that
// settles to their own bank account. At transaction time we pass the vendor's
// subaccount so Paystack splits the payout automatically. These helpers cover
// the onboarding: list banks (for the picker), resolve an account number to a
// name (so the vendor confirms), and create the subaccount.
//
// SERVER ONLY, same as the rest of this file: they use the platform secret key.
// ---------------------------------------------------------------------------

export type Bank = { name: string; code: string };

export type ListBanksResult =
  | { ok: true; banks: Bank[] }
  | { ok: false; error: string; status: number };

/** Nigerian bank/fintech list with NIP codes, for the settlement-account picker. */
export async function listBanks(): Promise<ListBanksResult> {
  let res: Response;
  try {
    res = await fetch(PAYSTACK_BASE + "/bank?currency=NGN", {
      method: "GET",
      headers: { Authorization: "Bearer " + secretKey() },
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
    data?: Array<{ name?: string; code?: string }>;
  };

  if (!res.ok || !b.status || !Array.isArray(b.data)) {
    return { ok: false, error: b.message ?? "Paystack list banks failed", status: res.status || 502 };
  }

  const banks: Bank[] = b.data
    .filter((x): x is { name: string; code: string } => Boolean(x.name && x.code))
    .map((x) => ({ name: x.name, code: x.code }));
  return { ok: true, banks };
}

export type ResolveAccountResult =
  | { ok: true; accountName: string; accountNumber: string }
  | { ok: false; error: string; status: number };

/** Resolve a bank account number to its registered name so the vendor confirms. */
export async function resolveAccountNumber(
  accountNumber: string,
  bankCode: string,
): Promise<ResolveAccountResult> {
  const qs = new URLSearchParams({
    account_number: accountNumber,
    bank_code: bankCode,
  }).toString();

  let res: Response;
  try {
    res = await fetch(PAYSTACK_BASE + "/bank/resolve?" + qs, {
      method: "GET",
      headers: { Authorization: "Bearer " + secretKey() },
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
    data?: { account_name?: string; account_number?: string };
  };

  if (!res.ok || !b.status || !b.data?.account_name) {
    return { ok: false, error: b.message ?? "Could not resolve this account", status: res.status || 502 };
  }

  return {
    ok: true,
    accountName: b.data.account_name,
    accountNumber: b.data.account_number ?? accountNumber,
  };
}

export type CreateSubaccountInput = {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  // Paystack percentage_charge: the MAIN (platform) account's share. Per the
  // official docs, percentage_charge: 20 means 20% to the main account and 80%
  // to the subaccount (vendor). So this is the PLATFORM FEE percent, not the
  // vendor's share.
  percentageCharge: number;
};

export type CreateSubaccountResult =
  | { ok: true; subaccountCode: string; accountName: string; settlementBankName: string }
  | { ok: false; error: string; status: number };

/** Create the vendor's Paystack subaccount; returns its code + resolved name. */
export async function createSubaccount(
  input: CreateSubaccountInput,
): Promise<CreateSubaccountResult> {
  let res: Response;
  try {
    res = await fetch(PAYSTACK_BASE + "/subaccount", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + secretKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name: input.businessName,
        // Paystack docs disagree on the field name (bank_code vs settlement_bank);
        // both carry the bank CODE, so we send both with the same value to be safe.
        bank_code: input.bankCode,
        settlement_bank: input.bankCode,
        account_number: input.accountNumber,
        percentage_charge: input.percentageCharge,
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
    data?: { subaccount_code?: string; account_name?: string; settlement_bank?: string };
  };

  if (!res.ok || !b.status || !b.data?.subaccount_code) {
    return { ok: false, error: b.message ?? "Paystack create subaccount failed", status: res.status || 502 };
  }

  return {
    ok: true,
    subaccountCode: b.data.subaccount_code,
    accountName: b.data.account_name ?? "",
    settlementBankName: b.data.settlement_bank ?? "",
  };
}
