import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and enforces basic route
 * guards:
 *   - unauthenticated user on a protected /(app) route   → redirect /sign-in
 *   - authenticated user on a /(auth) route              → redirect /dashboard
 *
 * Onboarding redirects are NOT done here (they need a DB read which is
 * expensive on every request). Instead, the (app) layouts handle them.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser refreshes the session if needed and is the only call
  // that should sit between createServerClient and the NextResponse return.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  const isAppRoute =
    path.startsWith("/dashboard") || path.startsWith("/onboarding");
  const isAuthRoute =
    path === "/sign-in" ||
    path === "/sign-up" ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password");

  if (!user && isAppRoute) {
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
