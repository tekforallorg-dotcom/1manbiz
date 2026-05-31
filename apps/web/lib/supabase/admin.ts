import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * USE ONLY in server-side code that has been verified to be acting on behalf
 * of a trusted system process (webhooks from Meta, background jobs, etc).
 * Never expose this client to any user-driven code path.
 *
 * Reads SUPABASE_SERVICE_ROLE_KEY from env. Throws at construction if missing
 * so misconfiguration is loud, not silent.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
