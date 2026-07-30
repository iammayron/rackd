# /db-migrate — generate, review, and apply a Drizzle migration (schema ⇄ core types in sync)

Drive a schema change through Drizzle safely. The text after the command describes the change (e.g. "add `notes` text to set_logs", "new table program_templates"). The hard rule this command enforces: **`packages/db/src/schema.ts` mirrors the `@rackd/core` types** — change both, or the layers drift.

First gather context yourself:

```bash
ls packages/db/drizzle 2>/dev/null | tail -5 || echo "(none yet / dir name may differ — check drizzle.config)"
git --no-pager diff --stat -- packages/db packages/core
```

- Schema: `packages/db/src/schema.ts`
- Core types: `packages/core/src/types.ts`

Steps:

1. **Edit the types first** (`@rackd/core` `types.ts`) — the domain shape is the source of truth. Then mirror the column(s)/table in `packages/db/src/schema.ts`: same field names, nullability, and units (weight columns store canonical **kg**, never lb).
2. **Generate the migration SQL** (writes a file, does NOT touch the DB):
   ```bash
   pnpm --filter @rackd/db db:generate
   ```
3. **Review the generated SQL before applying.** Show the new file's diff. Check for:
   - destructive ops (DROP COLUMN / TABLE, NOT NULL on an existing populated table without a default, type narrowing) — call these out explicitly, they can lose data;
   - FK actions (ON DELETE CASCADE / SET NULL) matching the prescription-vs-session and ownership intent;
   - the migration only contains _this_ change, nothing dragged in from local DB drift.
4. **Apply to Postgres** (needs `DATABASE_URL`; local Supabase or the target):
   ```bash
   pnpm --filter @rackd/db db:push
   ```
   If `DATABASE_URL` isn't set / no DB is reachable, stop after step 3 and report the SQL + the exact command to run when a DB is up — don't guess.
5. **Update repo functions / routes** that read or write the new field (`packages/db/src/index.ts`), and any client `qk` reads. New owned columns still scope by `ownerId`.
6. Gate: `pnpm typecheck && pnpm test`. If repo behavior changed, run the db suite (`pnpm --filter @rackd/db test`, needs Postgres) and consider `/test-author` for cascade/scoping coverage.

Report: types + schema edits, the generated SQL file, whether it was pushed (or why not), and any destructive op you flagged.
