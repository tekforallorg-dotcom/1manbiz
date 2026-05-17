import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Use in Client Components.
 * Cookies are read/written via document.cookie automatically by @supabase/ssr.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
