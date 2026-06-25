# /test-author — write tests for new/changed behavior

Write tests for this repo — real, behavior-pinning tests, not coverage theater. Match the existing test style; don't restate the implementation.

First, see what changed and what's already covered:

```bash
git --no-pager diff --stat HEAD
ls packages/core/src/*.test.ts
```

What to test, and where:

1. **Pure logic → `packages/core`.** Calculations (1RM, plates, volume, progression in `calc.ts`), the wall-clock timer (`timer.ts`), unit conversion (`units.ts`). Colocate as `<module>.test.ts` next to the source. Pattern: `import { describe, it, expect } from "vitest"`. See `calc.test.ts` for the house style — table-driven cases, exact expected numbers, edge/boundary inputs (zero, negative, empty, rounding seams). These are the priority: pure, fast, no setup.

2. **Repository functions → `packages/db`.** Tests run against a **real Postgres** (local Supabase / CI service container), truncate-per-test. Use the existing scaffolding — never reinvent it:
   - `test/setup.ts` truncates + re-seeds `SEED_EX` (`ex_bench`, `ex_squat`, `ex_row`) before each test. Use those stable ids.
   - `test/factories.ts` (`makeRoutine`, `OWNER_A`/`OWNER_B`, …) builds trees through the **real repo functions** — reach for it so a test reads as intent.
   - Name files `*.test.ts`; vitest picks them up via `vitest.config.ts`.
   - Cover the things a mock can't: **ownership scoping** (owner B can't read/mutate owner A's rows), FK **cascade / SET NULL** on delete, and the prescription→session deep-copy (routine tree copied into a session, logs land on the session tree — never mutate the routine).
   - If `packages/db` has no `test` script yet, add `"test": "vitest run"` to its `package.json` scripts so `pnpm test` (turbo) picks it up.

3. **Don't** write tests for API route handlers or UI unless asked — note them as untested instead.

Conventions: stored weight is canonical **kg** — assert in kg, not lb. Types come from `@rackd/core`; import, never redeclare. One behavior per `it`, assert the actual value (not just "truthy"). For the timer, pass an explicit `now` — never wall-clock real time.

Run what you wrote and report pass/fail verbatim:

```bash
pnpm --filter @rackd/core test
pnpm --filter @rackd/db test   # needs a running Postgres; if absent, say so
```

Report: files added, what each pins down, what you could not run (e.g. no DB) and why. If a test can't be written cleanly because the code isn't testable, say that instead of forcing it.
