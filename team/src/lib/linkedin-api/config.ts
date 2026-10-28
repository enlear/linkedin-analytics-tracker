// Configuration for the experimental LinkedIn Member Post Analytics sync.
//
// Server-only: import from server actions and route handlers, never from a
// client component (the client secret and token key live in these env vars).
// Everything is read at call time, so toggling a host env var takes effect on
// the next request without a rebuild.

export const LINKEDIN_AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
export const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
export const LINKEDIN_REST_BASE = "https://api.linkedin.com/rest";

/** Where LinkedIn sends the member back; must be registered on the LinkedIn app. */
export const LINKEDIN_CALLBACK_PATH = "/connect/linkedin/callback";

/**
 * Scopes requested at consent time. r_member_postAnalytics is the core scope
 * (Member Post Analytics API); r_member_social lets us enumerate the member's
 * own posts to discover their URNs + publish dates. Both live under the
 * Community Management API product and require LinkedIn app approval.
 *
 * Overridable via LINKEDIN_SCOPES so the scope set can be trimmed per approval
 * status without a code change.
 */
export const DEFAULT_LINKEDIN_SCOPES = "openid profile r_member_postAnalytics r_member_social";

/** Marketing API version header (YYYYMM). 202604+ exposes LINK_CLICKS etc. */
export const DEFAULT_LINKEDIN_API_VERSION = "202604";

/** The scopes the sync needs; surfaced as "permission missing" if absent. */
export const REQUIRED_SYNC_SCOPES = ["r_member_postAnalytics", "r_member_social"] as const;

/** Inert unless explicitly enabled, so deploying the code can't expose the flow. */
export function linkedinApiEnabled(): boolean {
  return process.env.LINKEDIN_API_ENABLED === "true";
}

export function linkedinApiVersion(): string {
  return process.env.LINKEDIN_API_VERSION || DEFAULT_LINKEDIN_API_VERSION;
}

export interface LinkedInClientCredentials {
  clientId: string;
  clientSecret: string;
}

export function linkedinClientCredentials(): LinkedInClientCredentials | null {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export interface LinkedInOAuthConfig extends LinkedInClientCredentials {
  redirectUri: string;
  scopes: string;
}

/**
 * Everything the OAuth round-trip needs, or null if it isn't configured.
 *
 * `origin` is the app's own origin for this request. The redirect URI defaults
 * to its callback path so one deployment works on every domain it's served
 * from; the authorize and exchange steps both derive it the same way, which
 * LinkedIn requires (the two redirect_uri values must match exactly).
 */
export function linkedinOAuthConfig(origin: string | null): LinkedInOAuthConfig | null {
  const credentials = linkedinClientCredentials();
  const redirectUri =
    process.env.LINKEDIN_REDIRECT_URI ||
    (origin ? new URL(LINKEDIN_CALLBACK_PATH, origin).toString() : "");
  if (!credentials || !redirectUri) return null;
  return {
    ...credentials,
    redirectUri,
    scopes: process.env.LINKEDIN_SCOPES || DEFAULT_LINKEDIN_SCOPES,
  };
}
