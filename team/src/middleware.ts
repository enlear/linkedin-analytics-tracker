import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseConfig } from "@/lib/supabase/env";

const PUBLIC_PREFIXES = ["/login", "/auth/"];

/**
 * Refreshes the Supabase session cookie on every request (server components
 * can read cookies but not write them) and sends signed-out visitors to /login.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Keeps CDNs from caching a response that carries someone's session.
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  // Verifies the JWT (and refreshes it when it's close to expiry). Nothing may
  // run between creating the client and this call, or sessions drop randomly.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
  if (!signedIn && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/login", request.nextUrl.origin));
    // Carry over any cookies the refresh attempt cleared.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // `.webmanifest` is excluded because Chrome fetches the manifest to decide
  // whether the app is installable, and does so from the signed-OUT login page
  // too. Redirecting it to /login returns HTML, the manifest fails to parse,
  // and the install option silently disappears.
  matcher: ["/((?!_next|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest)).*)"],
};
