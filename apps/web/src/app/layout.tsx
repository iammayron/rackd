import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { PrelineInit } from "@/components/PrelineInit";

export const metadata: Metadata = {
  title: "MyFit",
  description: "Plan and run your gym workouts. Local-first.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MyFit" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Providers>{children}</Providers>
        </div>
        <PrelineInit />
      </body>
    </html>
  );
}
