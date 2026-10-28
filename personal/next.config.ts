import type { NextConfig } from "next";

// Static export: `npm run build` writes plain HTML/JS/CSS to ./out, which any
// static host can serve. For a GitHub Pages project site the app lives under
// /<repo-name>, so the Pages workflow sets NEXT_PUBLIC_BASE_PATH.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
