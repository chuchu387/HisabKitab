import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import "@/app/globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0f172a"
};

export const metadata: Metadata = {
  title: "HisabKitab",
  description: "Multi-tenant accounting and expense management",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "HisabKitab",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "HisabKitab",
    "apple-mobile-web-app-status-bar-style": "black-translucent"
  },
  icons: {
    icon: "/icon.svg",
    apple: [{ url: "/pwa/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
