import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/api-auth";
import { resolveAccountNumber, createSubaccount } from "@/lib/paystack";

/**
 * Connect a vendor's Paystack subaccount for split settlement.
 *
 * Flow: resolve the account number to a name (so we never create a subaccount
 * for an unverifiable account), create the Paystack subaccount, then store the
 * subaccount + resolved bank details on the vendor's paystack payment_connectors
 * row and switch online payments on. Owner-scoped; uses the admin client only
 * after the business is resolved from the caller's user id. No secret is stored.
 *
 * The actual payout split happens once link init passes this subaccount (next
 * slice); storing it here is the onboarding step.
 */
export const dynamic = "force-dynamic";

// Platform's share of each online transaction (Paystack percentage_charge): the
// main account keeps this percent and the vendor's subaccount gets the rest.
// Adjust to set the SaaS take rate.
const PLATFORM_SPLIT_PERCENT = 2;

export async function POST(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let payload: { bankCode?: string; accountNumber?: string; bankName?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const bankCode = typeof payload.bankCode === "string" ? payload.bankCode.trim() : "";
  const accountNumber = typeof payload.accountNumber === "string" ? payload.accountNumber.trim() : "";
  const bankName = typeof payload.bankName === "string" ? payload.bankName.trim() : "";
  if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json(
      { ok: false, error: "A valid bank and 10-digit account number are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id, name")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No business" }, { status: 403 });
  }

  // Confirm the account resolves before creating anything.
  const resolved = await resolveAccountNumber(accountNumber, bankCode);
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
  }

  const created = await createSubaccount({
    businessName: business.name ?? "Vendor",
    bankCode,
    accountNumber,
    percentageCharge: PLATFORM_SPLIT_PERCENT,
  });
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: created.status });
  }

  const { error: upsertErr } = await admin.from("payment_connectors").upsert(
    {
      business_id: business.id,
      provider: "paystack",
      mode: "api",
      status: "connected",
      display_label: "Online card and transfer",
      subaccount_code: created.subaccountCode,
      settlement_bank_code: bankCode,
      settlement_bank_name: created.settlementBankName || bankName || null,
      settlement_account_number: accountNumber,
      settlement_account_name: resolved.accountName,
      platform_split_percent: PLATFORM_SPLIT_PERCENT,
      connected_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "business_id,provider" },
  );
  if (upsertErr) {
    console.error("[connectors/paystack/subaccount] upsert failed", upsertErr);
    return NextResponse.json({ ok: false, error: upsertErr.message }, { status: 500 });
  }

  // Connecting a settlement account means the vendor wants to collect online.
  await admin.from("businesses").update({ ai_sends_payment_link: true }).eq("id", business.id);

  return NextResponse.json({
    ok: true,
    subaccountCode: created.subaccountCode,
    accountName: resolved.accountName,
    bankName: created.settlementBankName || bankName,
    splitPercent: PLATFORM_SPLIT_PERCENT,
  });
}
