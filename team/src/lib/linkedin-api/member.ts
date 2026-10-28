import { getOrBootstrapCurrentEmployee } from "@/lib/data/employee";
import { linkedinApiEnabled } from "./config";
import { reject, type LinkedInFailure } from "./outcome";

/**
 * The signed-in member, or why the caller can't use the LinkedIn integration.
 * Checked in this order: feature flag, then sign-in, then role, so a
 * disabled deployment answers "disabled" to everyone.
 */
export async function requireLinkedInMember(
  adminMessage: string,
): Promise<{ ok: true; employeeId: string } | LinkedInFailure> {
  if (!linkedinApiEnabled()) {
    return reject("disabled", "The LinkedIn API integration is not enabled.");
  }
  const me = await getOrBootstrapCurrentEmployee();
  if (!me) return reject("unauthenticated", "Not authenticated.");
  // Admins aren't posters, so they have no personal analytics to connect.
  if (me.role !== "member") return reject("forbidden", adminMessage);
  return { ok: true, employeeId: me.id };
}
