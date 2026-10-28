import { createClient } from "@/lib/supabase/server";
import type { LinkedInConnectionState } from "@/lib/supabase/database.types";

// Non-secret view of an employee's LinkedIn connection, safe to pass to client
// components. Token ciphertext fields are intentionally NOT included — the
// status page never needs them and they should never reach the browser.
export interface LinkedInConnectionStatus {
  employeeId: string;
  status: LinkedInConnectionState | null;
  linkedinMemberUrn: string | null;
  grantedScopes: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

/**
 * Read the current member's LinkedIn connection status (owner-scoped).
 * Returns null when there's no row yet (never connected) or on any error —
 * the connection card treats null as the "not connected" state.
 */
export async function fetchLinkedInConnection(
  employeeId: string,
): Promise<LinkedInConnectionStatus | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("linkedin_connections")
      .select(
        "employee_id, status, linkedin_member_urn, granted_scopes, connected_at, last_synced_at, last_error",
      )
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (!data) return null;
    return {
      employeeId: data.employee_id,
      status: data.status,
      linkedinMemberUrn: data.linkedin_member_urn,
      grantedScopes: data.granted_scopes,
      connectedAt: data.connected_at,
      lastSyncedAt: data.last_synced_at,
      lastError: data.last_error,
    };
  } catch {
    return null;
  }
}
