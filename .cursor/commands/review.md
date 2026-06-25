# /review — review the current diff

Review the working changes in this repo. Be concise and specific — file:line, the problem, the fix. No praise, no restating the diff.

Read the diff first:

```bash
git --no-pager diff HEAD
git status --short
```

Review for:

1. **Correctness** — logic bugs, wrong signs, off-by-one, null/undefined handling, date/timezone handling, error paths.
2. **Conventions** — follow `AGENTS.md` and any matching `.cursor/rules/*.mdc`: domain logic stays in `packages/core` (pure, no platform deps), types imported from `@rackd/core` (never redeclared), Postgres access only via `@rackd/db` repository functions called from API route handlers (`apps/web/src/app/api/**`) — UI never touches the DB; it calls `api()` + React Query. Every owner-scoped route filters by `ownerId = token.sub`. Units stored canonical (kg), converted at the display edge.
3. **Gotchas** — prescription vs session trees, wall-clock timer, media is URL-only, DRY/KISS. Also: never value-import `@rackd/db` from a client component (pulls in `pg`, breaks the bundle) — `import type` only.
4. **Migrations/data** — Drizzle schema changes in `packages/db/src/schema.ts` stay in sync with `@rackd/core` types; new tables/columns need a generated migration.
5. **Tests** — pure logic in `core` has vitest coverage; the gate (`pnpm typecheck && pnpm test`) would pass.

Return findings grouped **Must-fix** / **Consider**, each with file:line and a concrete fix. If the diff is clean, say so plainly.
