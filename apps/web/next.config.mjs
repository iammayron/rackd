/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages (they ship TS source, not built dist).
  transpilePackages: ["@fitnow/core", "@fitnow/db", "@fitnow/ui"],
};

export default nextConfig;
