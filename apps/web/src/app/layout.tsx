import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PrelineInit } from "@/components/PrelineInit";
import { OrientationGuard } from "@/components/OrientationGuard";
import { ForegroundReflow } from "@/components/ForegroundReflow";
import { MiniWorkoutBar } from "@/features/active-workout/MiniWorkoutBar";

// Brand face — self-hosted at build by next/font, exposed as --font-hanken
// (wired into --font-sans in tokens.css). Weights match the Rackd type scale.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

// Set the theme before first paint (no flash). Reads the saved choice, else the
// OS preference. The full controller (toggle + live OS updates) lives in lib/theme.
const NO_FOUC = `(function(){try{var t=localStorage.getItem('rackd-theme');if(!t||t==='system'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export const metadata: Metadata = {
  title: "Rackd",
  description: "Plan, run, and track your gym workouts — local-first.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rackd",
  },
};

export const viewport: Viewport = {
  // Match the browser chrome to each theme's background.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1116" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={hanken.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
      </head>
      <body>
        <div className="app-shell">
          <div className="rk-status-scrim" aria-hidden="true" />
          <Providers>
            {children}
            <MiniWorkoutBar />
          </Providers>
        </div>
        <OrientationGuard />
        <ForegroundReflow />
        <PrelineInit />
      </body>
    </html>
  );
}
