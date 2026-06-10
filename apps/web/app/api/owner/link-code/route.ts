import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { generateLinkCode } from "@/lib/ai/owner/owner-actions";

/**
 * Generate (or reveal) the owner-mode WhatsApp link code for the caller's
 * business. The code is short-lived and single-use; the owner sends
 * "LINK <code>" from their personal WhatsApp to claim the shop. Mobile cannot
 * run server actions, so this is its HTTP door. Auth is dual-mode (Bearer for
 * mobile, cookie for web), and the business is always scoped to the caller -
 * a client-supplied id is never trusted.
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

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("id, owner_phone")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const biz = (business ?? null) as { id?: string; owner_phone?: string | null } | null;
  if (!biz?.id) {
    return NextResponse.json({ ok: false, error: "No business found" }, { status: 404 });
  }

  const result = await generateLinkCode(admin, biz.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    code: result.code,
    expires_at: result.expiresAt,
    already_linked: !!biz.owner_phone,
    linked_phone: biz.owner_phone ?? null,
  });
}
