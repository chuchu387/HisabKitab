import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const appManifest: MetadataRoute.Manifest & { display_override: string[]; id: string; scope: string } = {
    id: "/",
    name: "HisabKitab",
    short_name: "HisabKitab",
    description: "Multi-tenant accounting, sales and expense management",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "fullscreen"],
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
    ]
  };
  return appManifest;
}
