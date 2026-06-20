import { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSSRClient } from "@/lib/supabase/server";

/**
 * Dual-mode request auth, shared by the mobile-callable API routes. Mobile sends
 * a Bearer access token; web sends the session cookie. Returns the user id or
 * null. Mirrors the inline helper in /api/orders/mark-paid so new routes do not
 * each re-implement it.
 */
export async function authenticateRequest(request: NextRequest): Promise<string | null> {
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
