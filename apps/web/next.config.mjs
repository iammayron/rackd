import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import withSerwistInit from "@serwist/next";

const __dirname = dirname(fileURLToPath(import.meta.url));

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable in dev — SW caching only matters for the production PWA.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for Docker.
  output: "standalone",
  // Transpile workspace packages (they ship TS source, not built dist).
  transpilePackages: ["@myfit/core", "@myfit/db", "@myfit/ui"],
  // Monorepo: trace files from the repo root so build traces + standalone resolve.
  outputFileTracingRoot: join(__dirname, "../../"),
};

export default withSerwist(nextConfig);
