import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api-auth";
import { listBanks } from "@/lib/paystack";

/**
 * GET the Nigerian bank/fintech list (name + NIP code) for the settlement-account
 * picker. Auth-gated so it is not an open Paystack proxy, but not owner-specific.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const result = await listBanks();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, banks: result.banks });
}
