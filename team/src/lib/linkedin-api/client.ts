// LinkedIn HTTP calls for the OAuth round-trip and the post-analytics sync.

import {
  LINKEDIN_REST_BASE,
  LINKEDIN_TOKEN_URL,
  LINKEDIN_USERINFO_URL,
  linkedinApiVersion,
  type LinkedInClientCredentials,
  type LinkedInOAuthConfig,
} from "./config";
import type { RawPost } from "./posts";

// Bound enumeration so a member with a huge history can't run us past the
// host's function time limit / the dev-tier daily quota. If we hit it the sync
// reports `truncated` rather than silently dropping posts.
const POSTS_PAGE_SIZE = 50;
const MAX_POST_PAGES = 6;

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

export async function exchangeCodeForTokens(
  code: string,
  config: LinkedInOAuthConfig,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(
      `Token exchange failed (${res.status}): ${json.error_description ?? json.error ?? "unknown"}`,
    );
  }
  return json;
}

export async function fetchMemberUrn(accessToken: string): Promise<string> {
  const res = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { sub?: string };
  if (!res.ok || !json.sub) {
    throw new Error(`Could not read member identity from /v2/userinfo (${res.status}).`);
  }
  return `urn:li:person:${json.sub}`;
}

/**
 * Trade a refresh token for a new access token. Refresh-token issuance needs
 * LinkedIn approval; without it this is never reached and the member reconnects
 * when the ~60-day access token lapses.
 */
export async function refreshAccessToken(
  refreshToken: string,
  credentials: LinkedInClientCredentials,
): Promise<{ accessToken: string; expiresIn: number } | { error: string }> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
  });
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    return { error: `Token refresh failed: ${json.error_description ?? json.error ?? res.status}` };
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in ?? 0 };
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

function linkedinHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Linkedin-Version": linkedinApiVersion(),
  };
}

/**
 * GET with up to two retries on 429 / 5xx (dev-tier quotas + transient
 * errors). Backoff is kept short because the whole sync shares one function
 * invocation's time limit.
 */
async function linkedinGet(url: string, token: string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { headers: linkedinHeaders(token) });
    if (res.status !== 429 && res.status < 500) return res;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return fetch(url, { headers: linkedinHeaders(token) });
}

/** Enumerate the member's own posts (Posts API q=author), newest first. */
export async function enumeratePosts(
  memberUrn: string,
  token: string,
): Promise<{ posts: RawPost[]; truncated: boolean }> {
  const all: RawPost[] = [];
  let start = 0;
  let truncated = false;
  for (let page = 0; page < MAX_POST_PAGES; page++) {
    const url =
      `${LINKEDIN_REST_BASE}/posts?q=author` +
      `&author=${encodeURIComponent(memberUrn)}` +
      `&count=${POSTS_PAGE_SIZE}&start=${start}&sortBy=CREATED`;
    const res = await linkedinGet(url, token);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Posts API ${res.status}: ${text.slice(0, 300)}`);
    }
    const body = (await res.json()) as { elements?: RawPost[] };
    const elements = body.elements ?? [];
    all.push(...elements);
    if (elements.length < POSTS_PAGE_SIZE) break;
    start += POSTS_PAGE_SIZE;
    if (page === MAX_POST_PAGES - 1) truncated = true;
  }
  return { posts: all, truncated };
}

/** entity= param value per the docs: (ugc:<encoded>) or (share:<encoded>). */
function entityParam(urn: string): string {
  const encoded = encodeURIComponent(urn);
  if (urn.includes(":ugcPost:")) return `(ugc:${encoded})`;
  return `(share:${encoded})`;
}

/** Fetch a single lifetime (TOTAL) metric for one post. */
export async function fetchMetric(urn: string, queryType: string, token: string): Promise<number> {
  const url =
    `${LINKEDIN_REST_BASE}/memberCreatorPostAnalytics?q=entity` +
    `&entity=${entityParam(urn)}` +
    `&queryType=${queryType}&aggregation=TOTAL`;
  const res = await linkedinGet(url, token);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Analytics API ${res.status} for ${queryType}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { elements?: Array<{ count?: number }> };
  // TOTAL returns a single element; sum defensively in case of multiples.
  return (body.elements ?? []).reduce((acc, el) => acc + (el.count ?? 0), 0);
}
