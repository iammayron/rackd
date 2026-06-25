import { defineConfig } from "vitest/config";

/**
 * Repo-layer tests run against a REAL Postgres (the local Supabase container in
 * dev, a service container in CI) — the point is to exercise Drizzle queries +
 * FK cascade/SET-NULL behavior, which a mock can't. Isolation is truncate-per-
 * test (see test/setup.ts). `singleFork` so tests never race on the shared tables.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      DATABASE_SSL: process.env.DATABASE_SSL ?? "false",
    },
  },
});
