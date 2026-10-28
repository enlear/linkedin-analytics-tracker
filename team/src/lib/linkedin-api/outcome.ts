// Result shapes of the LinkedIn connect / sync server actions:
// { ok, code, message, ... } objects. Types only (plus a tiny constructor), so
// the connection card can import them safely.

export type LinkedInErrorCode =
  | "disabled"
  | "unauthenticated"
  | "forbidden"
  | "misconfigured"
  | "invalid_arg"
  | "state_mismatch"
  | "exchange_failed"
  | "invalid_file"
  | "not_connected"
  | "permission_missing"
  | "reauth_required"
  | "fetch_failed"
  // A database write failed. A server action that throws loses its message in
  // production builds, so the failure is returned instead.
  | "server_error";

export interface LinkedInFailure {
  ok: false;
  code: LinkedInErrorCode;
  message: string;
}

export function reject(code: LinkedInErrorCode, message: string): LinkedInFailure {
  return { ok: false, code, message };
}

export type AuthUrlOutcome = { ok: true; code: "auth_url"; url: string } | LinkedInFailure;

export type ExchangeOutcome =
  | {
      ok: true;
      code: "connected";
      status: "connected";
      grantedScopes: string;
      linkedinMemberUrn: string;
    }
  | LinkedInFailure;

export type DisconnectOutcome =
  | { ok: true; code: "disconnected"; status: "disconnected" }
  | LinkedInFailure;

export interface SyncSummary {
  /** First day of the synced report month, YYYY-MM-DD. */
  reportMonth: string;
  /** Posts whose publish date files them under that month. */
  matched: number;
  written: number;
  /** Already on file (by post URL), from an upload or an earlier sync. */
  skipped: number;
  failed: number;
  /** The post scan hit its page cap, so older posts may have been missed. */
  truncated: boolean;
}

export type SyncOutcome =
  | { ok: true; code: "fetched"; message: string; summary: SyncSummary }
  | LinkedInFailure;
