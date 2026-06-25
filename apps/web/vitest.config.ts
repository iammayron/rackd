import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Two kinds of tests live here:
 *  - API route tests (default `node` env) call the exported route handlers
 *    directly and run REAL Drizzle queries against the local Postgres. Auth is
 *    stubbed at the Supabase seam (test/setup.ts) so a `Bearer <id>` header maps
 *    to user `{ id }` — that's how owner-isolation cases pick "who is calling".
 *    Those files call `resetDb()` from test/db-helper in beforeEach.
 *  - Client-lib tests opt into jsdom per-file with `// @vitest-environment jsdom`
 *    and mock fetch/idb-keyval — no DB.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
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
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon",
      SUPABASE_SERVICE_ROLE_KEY: "test-service",
    },
  },
});
