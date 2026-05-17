import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for RSC, Server Actions, and Route Handlers.
 * Cookies are read from Next's cookies() API.
 *
 * Note: cookie writes are best-effort. In Server Components, setting cookies
 * throws — that's fine, the middleware refreshes sessions on the next request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies cannot be set here.
            // Middleware handles session refresh on the next request.
          }
        },
      },
    },
  );
}
