import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { sendReceiptForOrder } from "@/lib/receipt-send";

/**
 * Resend a paid order's receipt to the customer on WhatsApp (owner action).
 *
 * Unlike the auto-send tied to the paid transition, this is an explicit resend,
 * so it passes force: true to bypass the receipt_sent_at dupe guard. It still
 * only sends for a paid order with a receipt_code and a connected WhatsApp
 * thread inside the 24h window; otherwise it returns sent: false with a reason
 * the client surfaces (e.g. share the link manually instead).
 *
 * Auth: dual-mode (Bearer for mobile, cookie for web), mirroring mark-paid.
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
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  let payload: { orderId?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: business } = await admin
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ ok: false, error: "No business" }, { status: 403 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("id", orderId)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const result = await sendReceiptForOrder(admin, {
    orderId,
    origin: request.nextUrl.origin,
    force: true,
  });

  if (result.sent) {
    return NextResponse.json({ ok: true, sent: true });
  }
  return NextResponse.json({ ok: true, sent: false, reason: result.reason });
}
