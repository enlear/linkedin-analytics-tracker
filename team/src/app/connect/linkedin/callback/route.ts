import { NextResponse, type NextRequest } from "next/server";
import { completeLinkedInAuth } from "@/lib/linkedin-api/oauth";

// OAuth redirect target registered in the LinkedIn developer app:
//   {APP_URL}/connect/linkedin/callback
//
// LinkedIn sends the member back here with ?code & ?state (or ?error). We
// exchange the code server-side (only the server holds the client secret and
// token encryption key), then bounce back to /upload with a status the
// connection card can render.
function back(origin: string, params: Record<string, string>) {
  const url = new URL("/upload", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);

  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (error) {
    return back(origin, {
      linkedin: "error",
      linkedin_error: errorDescription || error,
    });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return back(origin, { linkedin: "error", linkedin_error: "Missing code or state." });
  }

  try {
    const outcome = await completeLinkedInAuth(origin, code, state);
    if (!outcome.ok) {
      return back(origin, {
        linkedin: "error",
        linkedin_error: outcome.message || "Could not complete the connection.",
      });
    }
    return back(origin, { linkedin: "connected" });
  } catch (e) {
    return back(origin, {
      linkedin: "error",
      linkedin_error: e instanceof Error ? e.message : "Connection failed.",
    });
  }
}
