# /verify — verify a change actually works

Verify that a change actually works — not just that it compiles. Read-only: never commit, push, or mutate data.

1. Run the gate and report failures verbatim:
   ```bash
   pnpm typecheck && pnpm test
   ```
2. Identify what changed and which areas it affects:
   ```bash
   git --no-pager diff --stat HEAD
   ```
3. For logic/data changes (`packages/core`, `packages/db`), read the relevant module and confirm behavior matches the intended rule. Run `pnpm --filter @rackd/core test` for fast logic checks; never write data. Repo/route changes have no automated tests yet unless a DB is up — read them and reason about ownership scoping + query shape.
4. For UI / API-route changes (`apps/web`), confirm it builds (`pnpm --filter @rackd/web build`) — the build also proves no `pg` leaked into the client bundle. Note the exact route(s)/screens to check manually. If browser tooling is available, open the route and confirm it renders.
5. Report: what passed, what to verify manually, and any discrepancy. Be honest about what you could not verify.
