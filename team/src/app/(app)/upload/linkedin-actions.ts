"use server";

// EXPERIMENTAL LinkedIn Member Post Analytics — the connection card's server
// actions. Inert (every call answers code "disabled") unless the host sets
// LINKEDIN_API_ENABLED=true. See docs/linkedin-member-analytics-setup.md.

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { startLinkedInAuth, disconnectLinkedInAccount } from "@/lib/linkedin-api/oauth";
import { syncLinkedInPosts } from "@/lib/linkedin-api/sync";
import {
  reject,
  type AuthUrlOutcome,
  type DisconnectOutcome,
  type SyncOutcome,
} from "@/lib/linkedin-api/outcome";

/**
 * This request's app origin, for the default OAuth redirect URI. Browsers send
 * Origin on a server-action POST and Next.js rejects an action whose Origin
 * doesn't match the host, so it's safe to build the redirect URI from.
 */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : null;
}

// A thrown server action reaches the browser as a generic message in
// production builds, so unexpected failures come back as a result instead.
function serverError(e: unknown) {
  return reject("server_error", e instanceof Error ? e.message : "Something went wrong.");
}

export async function getLinkedInAuthUrl(): Promise<AuthUrlOutcome> {
  try {
    return await startLinkedInAuth(await requestOrigin());
  } catch (e) {
    return serverError(e);
  }
}

export async function disconnectLinkedIn(): Promise<DisconnectOutcome> {
  try {
    return await disconnectLinkedInAccount(await requestOrigin());
  } catch (e) {
    return serverError(e);
  }
}

/** Import the member's own posts filed under `reportMonthIso` (YYYY-MM-01). */
export async function syncLinkedIn(reportMonthIso: string): Promise<SyncOutcome> {
  try {
    const outcome = await syncLinkedInPosts(reportMonthIso);
    if (outcome.ok && outcome.summary.written > 0) {
      revalidatePath("/dashboard");
      revalidatePath("/upload");
      revalidatePath("/team");
    }
    return outcome;
  } catch (e) {
    return serverError(e);
  }
}
