// OAuth lifecycle for a member's own LinkedIn connection: start (authorize
// URL), complete (code exchange) and disconnect. Writes go through the
// member's own Supabase session, so RLS limits them to their row.

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { LINKEDIN_AUTHORIZE_URL, linkedinOAuthConfig } from "./config";
import { exchangeCodeForTokens, fetchMemberUrn, type TokenResponse } from "./client";
import { requireLinkedInMember } from "./member";
import {
  reject,
  type AuthUrlOutcome,
  type DisconnectOutcome,
  type ExchangeOutcome,
} from "./outcome";
import { encryptToken } from "./token-crypto";

type ConnectionWrite = Database["public"]["Tables"]["linkedin_connections"]["Insert"];

// Starting or completing a connection REPLACES the member's row: spreading
// this first means a reconnect never inherits stale tokens, scopes or errors
// from the previous connection.
const EMPTY_CONNECTION: Omit<ConnectionWrite, "employee_id"> = {
  status: null,
  linkedin_member_urn: null,
  granted_scopes: null,
  pending_state: null,
  access_token_enc: null,
  refresh_token_enc: null,
  access_token_expires_at: null,
  refresh_token_expires_at: null,
  connected_at: null,
  last_synced_at: null,
  last_error: null,
};

function misconfigured() {
  return reject("misconfigured", "LinkedIn client id/secret or redirect URI is not configured.");
}

/** Begin the 3-legged flow: store a one-time state and return LinkedIn's consent URL. */
export async function startLinkedInAuth(origin: string | null): Promise<AuthUrlOutcome> {
  const member = await requireLinkedInMember("Admins don't have personal post analytics to connect.");
  if (!member.ok) return member;
  const config = linkedinOAuthConfig(origin);
  if (!config) return misconfigured();

  const state = randomBytes(16).toString("hex");
  const supabase = await createClient();
  const { error } = await supabase.from("linkedin_connections").upsert({
    ...EMPTY_CONNECTION,
    employee_id: member.employeeId,
    status: "pending",
    pending_state: state,
  });
  if (error) throw new Error(error.message);

  const url = new URL(LINKEDIN_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  return { ok: true, code: "auth_url", url: url.toString() };
}

/**
 * Finish the flow from the callback: check `state` against the one stored for
 * THIS member (so a callback can't be replayed into someone else's session),
 * trade the code for tokens and store them encrypted.
 */
export async function completeLinkedInAuth(
  origin: string | null,
  code: string,
  state: string,
): Promise<ExchangeOutcome> {
  const member = await requireLinkedInMember("Admins don't have personal post analytics to connect.");
  if (!member.ok) return member;
  const config = linkedinOAuthConfig(origin);
  if (!config) return misconfigured();
  if (!code || !state) return reject("invalid_arg", "Missing code or state.");

  const { employeeId } = member;
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("linkedin_connections")
    .select("pending_state")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing || existing.pending_state !== state) {
    return reject("state_mismatch", "OAuth state did not match. Please retry the connection.");
  }

  let tokens: TokenResponse;
  let memberUrn: string;
  try {
    tokens = await exchangeCodeForTokens(code, config);
    memberUrn = await fetchMemberUrn(tokens.access_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Token exchange failed.";
    const { error } = await supabase
      .from("linkedin_connections")
      .update({ status: "error", last_error: msg, pending_state: null })
      .eq("employee_id", employeeId);
    if (error) throw new Error(error.message);
    return reject("exchange_failed", msg);
  }

  const now = Date.now();
  const grantedScopes = tokens.scope ?? config.scopes;
  const { error } = await supabase.from("linkedin_connections").upsert({
    ...EMPTY_CONNECTION,
    employee_id: employeeId,
    status: "connected",
    linkedin_member_urn: memberUrn,
    granted_scopes: grantedScopes,
    access_token_enc: encryptToken(tokens.access_token),
    refresh_token_enc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    access_token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
    refresh_token_expires_at: tokens.refresh_token_expires_in
      ? new Date(now + tokens.refresh_token_expires_in * 1000).toISOString()
      : null,
    connected_at: new Date(now).toISOString(),
  });
  if (error) throw new Error(error.message);

  return {
    ok: true,
    code: "connected",
    status: "connected",
    grantedScopes,
    linkedinMemberUrn: memberUrn,
  };
}

/** Forget the stored tokens. Posts already imported are left alone. */
export async function disconnectLinkedInAccount(origin: string | null): Promise<DisconnectOutcome> {
  const member = await requireLinkedInMember("Admins don't have personal post analytics to connect.");
  if (!member.ok) return member;
  // Disconnecting needs no LinkedIn call, but it still reports a misconfigured
  // deployment, the same way connect and sync do.
  if (!linkedinOAuthConfig(origin)) return misconfigured();

  const supabase = await createClient();
  const { error } = await supabase
    .from("linkedin_connections")
    .update({
      status: "disconnected",
      access_token_enc: null,
      refresh_token_enc: null,
      access_token_expires_at: null,
      refresh_token_expires_at: null,
      pending_state: null,
      linkedin_member_urn: null,
      granted_scopes: null,
    })
    .eq("employee_id", member.employeeId);
  if (error) throw new Error(error.message);
  return { ok: true, code: "disconnected", status: "disconnected" };
}
