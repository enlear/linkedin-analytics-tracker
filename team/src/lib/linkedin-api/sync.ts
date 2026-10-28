// Pull the signed-in member's own LinkedIn posts for one report month and file
// them as post_uploads rows (source "linkedin_api"), with the same day-20
// filing and URL de-dup rules as the xlsx upload path.

import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import type { LinkedInConnectionRecord } from "@/lib/supabase/database.types";
import { toIsoDate } from "@/lib/period";
import { REQUIRED_SYNC_SCOPES, linkedinClientCredentials } from "./config";
import { enumeratePosts, fetchMetric, refreshAccessToken } from "./client";
import { requireLinkedInMember } from "./member";
import { reject, type SyncOutcome } from "./outcome";
import {
  API_IMPORT_FILE_NAME,
  METRIC_QUERY_TYPES,
  matchPostsToReportMonth,
  parseReportMonth,
  toPostUploadRow,
  type RawPost,
} from "./posts";
import { decryptToken, encryptToken } from "./token-crypto";

type Connection = Pick<
  LinkedInConnectionRecord,
  | "employee_id"
  | "status"
  | "linkedin_member_urn"
  | "granted_scopes"
  | "access_token_enc"
  | "refresh_token_enc"
  | "access_token_expires_at"
  | "refresh_token_expires_at"
>;

/** Postgres unique_violation: the post_uploads accepted-URL index fired. */
const UNIQUE_VIOLATION = "23505";

export async function syncLinkedInPosts(reportMonthInput: string): Promise<SyncOutcome> {
  const member = await requireLinkedInMember("Admins don't have personal post analytics to sync.");
  if (!member.ok) return member;
  const { employeeId } = member;
  const supabase = await createClient();

  // ---- Verify employee + connection ---------------------------------------
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .maybeSingle();
  if (employeeError) throw new Error(employeeError.message);
  if (!employee) return reject("invalid_file", "Employee record not found.");

  const { data: conn, error: connError } = await supabase
    .from("linkedin_connections")
    .select(
      "employee_id, status, linkedin_member_urn, granted_scopes, access_token_enc, refresh_token_enc, access_token_expires_at, refresh_token_expires_at",
    )
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (connError) throw new Error(connError.message);
  if (!conn || conn.status !== "connected" || !conn.linkedin_member_urn) {
    return reject("not_connected", "Connect your LinkedIn account first.");
  }

  // ---- Scope check --------------------------------------------------------
  const granted = (conn.granted_scopes ?? "").split(/\s+/).filter(Boolean);
  const missing = REQUIRED_SYNC_SCOPES.filter((s) => !granted.includes(s));
  if (missing.length > 0) {
    return reject(
      "permission_missing",
      `Missing LinkedIn permission(s): ${missing.join(", ")}. Reconnect and approve all requested scopes.`,
    );
  }

  // ---- Token --------------------------------------------------------------
  const tokenResult = await ensureAccessToken(supabase, conn);
  if ("error" in tokenResult) {
    await recordSyncResult(supabase, employeeId, tokenResult.error, "error");
    return reject("reauth_required", tokenResult.error);
  }
  const token = tokenResult.token;

  // ---- Period -------------------------------------------------------------
  const selected = parseReportMonth(String(reportMonthInput));
  if (!selected) return reject("invalid_arg", "reportMonth must be YYYY-MM-DD.");
  const reportMonth = toIsoDate(selected.reportMonth);

  // ---- Enumerate + filter to the selected report month --------------------
  let enumerated: { posts: RawPost[]; truncated: boolean };
  try {
    enumerated = await enumeratePosts(conn.linkedin_member_urn, token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not list your posts.";
    await recordSyncResult(supabase, employeeId, msg, "error");
    return reject("fetch_failed", msg);
  }
  const inMonth = matchPostsToReportMonth(enumerated.posts, selected);

  // ---- Per-post analytics + write -----------------------------------------
  // Sequential on purpose: the dev tier allows ~100 calls/member/day and a
  // burst invites 429s. The de-dup check runs first so re-running a sync that
  // timed out part-way spends API calls only on the posts it hadn't reached.
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const matched of inMonth) {
    try {
      if (await isDuplicate(supabase, matched.postUrl)) {
        skipped++;
        continue;
      }
      const [impressions, reach] = await Promise.all([
        fetchMetric(matched.post.id, METRIC_QUERY_TYPES.impressions, token),
        fetchMetric(matched.post.id, METRIC_QUERY_TYPES.reach, token),
      ]);
      const { error } = await supabase
        .from("post_uploads")
        .insert(toPostUploadRow(employeeId, matched, { impressions, reach }));
      // Someone uploaded the same post between the check and the insert.
      if (error?.code === UNIQUE_VIOLATION) {
        skipped++;
        continue;
      }
      if (error) throw new Error(error.message);
      written++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "metric fetch failed";
      errors.push(`${matched.post.id}: ${msg}`);
    }
  }

  if (written > 0) {
    const { error } = await supabase.from("upload_activity").insert({
      employee_id: employeeId,
      action: "upload_accepted",
      file_name: API_IMPORT_FILE_NAME,
      details: {
        source: "linkedin_api",
        report_month: reportMonth,
        written,
        skipped,
        errors: errors.length,
      },
    });
    if (error) throw new Error(error.message);
  }

  const lastError = errors.length > 0 ? `${errors.length} post(s) failed: ${errors[0]}` : null;
  await recordSyncResult(
    supabase,
    employeeId,
    lastError,
    errors.length && written === 0 ? "error" : "connected",
  );

  // A run that found posts but couldn't write ANY of them is a failure.
  if (inMonth.length > 0 && written === 0 && skipped === 0 && errors.length > 0) {
    return reject("fetch_failed", lastError ?? "All metric fetches failed.");
  }

  return {
    ok: true,
    code: "fetched",
    message:
      written > 0
        ? `Imported ${written} post(s) from LinkedIn for ${reportMonth}.`
        : `No new posts to import for ${reportMonth}.`,
    summary: {
      reportMonth,
      matched: inMonth.length,
      written,
      skipped,
      failed: errors.length,
      truncated: enumerated.truncated,
    },
  };
}

// ---------------------------------------------------------------------------
// Token freshness — refresh if expired and a refresh token is available.
// (Refresh-token issuance requires LinkedIn approval; without it tokens last
// ~60 days and the member must re-auth. We surface "reauth_required" then.)
// ---------------------------------------------------------------------------
async function ensureAccessToken(
  supabase: SupabaseServerClient,
  conn: Connection,
): Promise<{ token: string } | { error: string }> {
  if (!conn.access_token_enc) return { error: "No access token stored." };

  const expiresAt = conn.access_token_expires_at ? Date.parse(conn.access_token_expires_at) : 0;
  const stillValid = expiresAt - Date.now() > 60_000; // 1-min safety margin
  if (stillValid) return { token: decryptToken(conn.access_token_enc) };

  if (!conn.refresh_token_enc) {
    return { error: "Access token expired and no refresh token is available." };
  }
  const refreshExpiresAt = conn.refresh_token_expires_at
    ? Date.parse(conn.refresh_token_expires_at)
    : 0;
  if (refreshExpiresAt && refreshExpiresAt < Date.now()) {
    return { error: "Refresh token expired." };
  }

  const credentials = linkedinClientCredentials();
  if (!credentials) return { error: "LinkedIn client not configured." };

  const refreshed = await refreshAccessToken(decryptToken(conn.refresh_token_enc), credentials);
  if ("error" in refreshed) return refreshed;

  const { error } = await supabase
    .from("linkedin_connections")
    .update({
      access_token_enc: encryptToken(refreshed.accessToken),
      access_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    })
    .eq("employee_id", conn.employee_id);
  if (error) throw new Error(error.message);
  return { token: refreshed.accessToken };
}

async function isDuplicate(supabase: SupabaseServerClient, postUrl: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("post_uploads")
    .select("id")
    .eq("post_url", postUrl)
    .eq("validation_status", "accepted")
    .limit(1);
  if (error) throw new Error(error.message);
  return data.length > 0;
}

async function recordSyncResult(
  supabase: SupabaseServerClient,
  employeeId: string,
  lastError: string | null,
  status: "connected" | "error",
): Promise<void> {
  const { error } = await supabase
    .from("linkedin_connections")
    .update({ last_synced_at: new Date().toISOString(), last_error: lastError, status })
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
}
