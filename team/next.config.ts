import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads are sent straight to server actions. 4 MB stays under the
    // ~4.5 MB request limit of serverless hosts such as Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "static.licdn.com" },
      // Google account photos (Supabase Auth stores them as avatar_url).
      // Avatars render through Radix (a plain <img>) so this isn't needed today,
      // but it keeps next/image working if an avatar is ever moved onto it.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
