// Branding for your deployment. Override any value with the matching
// NEXT_PUBLIC_* env var (in `.env.local` or your hosting provider) — no code
// change needed. NEXT_PUBLIC_* values are inlined at build time.
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "LinkedIn Analytics Tracker",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "LI Tracker",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "Track your team's LinkedIn reach and growth over time.",
  // Path under /public or an absolute URL. Square images look best.
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || "/logo.svg",
};
