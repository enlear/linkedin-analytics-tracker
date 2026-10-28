import type { MetadataRoute } from "next";
import { siteConfig } from "@/site.config";

// Served at /manifest.webmanifest. Generated so the installed PWA picks up the
// name from site.config.ts instead of a hard-coded JSON file.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    theme_color: "#f8f8f7",
    background_color: "#f8f8f7",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Upload a post", short_name: "Upload", url: "/upload?source=pwa" },
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard?source=pwa" },
    ],
  };
}
