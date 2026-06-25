import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit config — points at DATABASE_URL (local Supabase Postgres in dev,
 * the Supabase Cloud connection string in prod). Run from packages/db:
 *   pnpm drizzle-kit generate   # author SQL migration from schema.ts
 *   pnpm drizzle-kit push       # apply to the DATABASE_URL Postgres
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
