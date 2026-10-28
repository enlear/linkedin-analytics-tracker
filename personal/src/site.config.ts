// Branding for your deployment. Override with NEXT_PUBLIC_* env vars in
// `.env.local` or your CI — values are inlined at build time.
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "LinkedIn Analytics Tracker",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "Private LinkedIn analytics from your own export. Your data never leaves your browser.",
  /** Shown in the footer as "Source code". Leave empty to hide. */
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL || "",
};
