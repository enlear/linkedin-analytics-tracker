import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sign-in and email confirmation links land. Exchanges the
 * one-time code (or email token) for a session cookie, then opens the app.
 *
 * A code only exchanges in the browser that started the flow. Someone who
 * opens their confirmation email on another device is still confirmed, so
 * the login page tells them to sign in rather than reporting a failure.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (ok) return NextResponse.redirect(new URL("/dashboard", origin));
  // Google sends the user back with ?error=… when they cancel or it fails.
  const reason = searchParams.get("error") ? "oauth_failed" : "link";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
}
