import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { initPaymentForOrder } from "@/lib/payments/init";

/**
 * Initialize a Paystack hosted-checkout payment for a pending order.
 *
 * Auth: dual-mode (cookie session for web, Bearer JWT for mobile), mirroring
 * /api/messages/send. The actual init logic lives in lib/payments/init so the
 * web sendPaymentLinkAction server action shares it without drift.
 */

export const dynamic = "force-dynamic";

async function authenticate(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (!token) return null;
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  }
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: { orderId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";

  const result = await initPaymentForOrder(userId, orderId, request.nextUrl.origin);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    authorization_url: result.authorizationUrl,
    reference: result.reference,
  });
}
