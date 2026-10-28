// Client-safe constants for the social-platform multi-platform feature.
// Kept out of `lib/data/company-analytics.ts` because that module imports the
// server-only Supabase client (which uses `next/headers`), so any client
// component pulling these constants from there would fail to compile with
// "You're importing a component that needs 'next/headers'".

import type { SocialPlatform } from "@/lib/supabase/database.types";

export type { SocialPlatform };

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

// Platforms we've shipped end-to-end (importer + UI). Anything else is
// rendered as "coming soon" in the dialog and on the tabs.
export const SUPPORTED_PLATFORMS: SocialPlatform[] = [
  "linkedin",
  "tiktok",
  "facebook",
  "instagram",
];

// Facebook + Instagram use the Graph API fetch flow (no file upload) — they
// share one Meta connection token.
export const API_FETCH_PLATFORMS: SocialPlatform[] = ["facebook", "instagram"];
