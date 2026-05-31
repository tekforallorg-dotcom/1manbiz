import { supabase } from "./supabase";

// Resolves the active business for the current user.
// MVP: returns the first business the user owns. Multi-tenant support
// (switching between businesses, staff/admin roles) is a future slice.
//
// Returns null if the user has no business yet (e.g. mid-onboarding).
export async function getActiveBusinessId(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[business] getActiveBusinessId error:", error);
    return null;
  }
  return data?.id ?? null;
}
