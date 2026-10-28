// Feature flags.
//
// Flags are read from NEXT_PUBLIC_* env vars so the SAME value is available in
// both server components and client components without an extra round-trip.
// Anything NEXT_PUBLIC_* is inlined at build time, so toggling a flag requires
// a redeploy (acceptable for an experimental gate).

/**
 * EXPERIMENTAL employee-side LinkedIn post-analytics automation (OAuth + the
 * Member Post Analytics API). Default OFF. Set NEXT_PUBLIC_FEATURE_LINKEDIN_API
 * to "true" to surface the "Connect LinkedIn" UI.
 *
 * Note: the matching backend env var LINKEDIN_API_ENABLED must ALSO be "true"
 * for the server to do anything — this flag only controls the UI. Keeping them
 * separate lets you ship the UI to a staging branch while the backend stays
 * inert, and vice-versa.
 */
export const LINKEDIN_API_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_LINKEDIN_API === "true";
