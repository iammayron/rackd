# rackd — project rules

Gym workout tracker (plan routines, run workouts, rest timer, history). PWA web first; React Native mobile later sharing the same core. pnpm + Turborepo monorepo, TypeScript strict, Next.js 15 / React 19. Data in Supabase Postgres via Drizzle ORM, served through Next API routes; client uses React Query with an IndexedDB offline cache + mutation queue. Keep changes small, typed, and tested.

<!-- This file is AGENTS.md: always-on instructions read by Cursor (and other
     agents) for every file. Global rules live here; area/package-specific detail
     lives in glob-scoped .cursor/rules/*.mdc. CLAUDE.md is kept in sync alongside
     this for teams that also run Claude Code. -->

## Commands

> **Local dev is `pnpm dev`** (web on :3000, hot reload). Deploy is **Fly.io**
> (app `rackd` at rackd.fly.dev), auto-deployed by GitHub Actions on push to
> `main`. No Docker Compose, no local sync server. See `DEPLOY.md` and
> `docs/specs/fly-setup-guide.md`.

- `pnpm dev` — run all apps (web on :3000)
- `pnpm --filter @rackd/web dev` — web only
- `pnpm typecheck` — type check all packages (run before every commit)
- `pnpm test` — run tests (vitest in `@rackd/core`)
- `pnpm --filter @rackd/core test` — fast core logic tests
- `pnpm build` — production build
- `pnpm --filter @rackd/db db:generate` / `db:push` — generate/apply Drizzle migrations against `DATABASE_URL`
- `pnpm --filter @rackd/db seed` — seed the exercise library into Postgres (run once)

Before committing, run: `pnpm typecheck && pnpm test`. The fast gate (typecheck +
`@rackd/core` test) is `pnpm typecheck && pnpm --filter @rackd/core test` — it
skips the Postgres-dependent suites (`@rackd/db`, `apps/web` API tests); run the
full `pnpm test` yourself when you changed repo functions, schema, or API routes
and a DB is up.

No formatter/linter is wired yet — there is no `lint`/`format` script. Don't
reference one until it actually exists. (The Cursor format hook auto-detects a
formatter at runtime and no-ops until one is added.)

Cursor commands (`.cursor/commands/`): `/add-endpoint` (scaffold an owner-scoped
route + repo fn + query wiring), `/db-migrate` (Drizzle generate→review→push,
keeping schema ⇄ `@rackd/core` types in sync), `/test-author` / `/test-auditor`
(write and vet tests), plus `/ship`, `/commit-push-pr`, `/review`, `/verify`.

### Auth (Supabase Cloud)

- Supabase Cloud issues the JWTs; the client is unchanged. Web env:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (baked at build).
- The app is auth-gated (no anonymous use). After login `AuthProvider` holds the
  Supabase session; the `api()` helper attaches `Authorization: Bearer <access_token>`
  to every request. `getCurrentUserId()` = Supabase user id (client-side reads).
- API routes validate that token server-side via `SUPABASE_SERVICE_ROLE_KEY`
  (`lib/api-auth.ts` → `getAuthUser` / `withUser`), derive `ownerId` from the
  token's `sub`, and scope every query by `ownerId`. The exercise + sharedRoutines
  libraries are the public exceptions (world-readable, owner-writable).
- No Triplit signing-key dance, no RS256/HS256 JWK, no `SUPABASE_JWT_SECRET`.

### Data layer

- **Drizzle ORM → Supabase Postgres.** `packages/db` owns the schema and the
  repository functions; nothing else touches `pg` (single pool in `db.ts`).
- **Reads/writes go through Next API route handlers** under
  `apps/web/src/app/api/**` (~43 routes). The client never calls the DB — it calls
  `api()` (`lib/api.ts`) wrapped in **React Query** (`lib/query.ts`, central `qk`
  key registry). The query cache is persisted to IndexedDB for offline reads; a
  write that fails offline is queued in IndexedDB (`lib/offline-queue.ts`) and
  flushed FIFO on reconnect.
- `apps/push` polls Postgres (`getPendingPushes()`) to deliver scheduled web-push
  notifications (needs `DATABASE_URL` + VAPID env). No Triplit anywhere.

## Architecture

Logic lives in `packages/`; apps are thin shells.

- `packages/core` — pure domain logic + **all domain types**. ZERO platform/UI/DB deps. This is what React Native reuses later.
- `packages/db` — Drizzle schema + repository functions (the only place that touches Postgres).
- `packages/ui` — design tokens (`tokens.css`) + shared helpers.
- `apps/web` — Next.js App Router PWA. `src/app/api/**` is the data-access layer (route handlers call `@rackd/db` repo functions); the client uses React Query over an `api()` fetch helper.

## Conventions

- **Types live once in `@rackd/core`** (`src/types.ts`). Import them everywhere; never redeclare a domain shape (DRY).
- **DB access only through `@rackd/db` repository functions** (`startSession`, `logSet`, `finishSession`, …) — they use the Drizzle `db` (no client argument) and are called from **API route handlers only**. The UI never touches the DB; it calls `api()` / React Query, which hit the routes. Keeps mutations in one place and the engine swappable.
- **Units stored canonical (kg)**, converted at the display edge via `formatWeight`/`fromKg`. Never store lb.
- **Calculations** (1RM, plates, volume, progression) live in `packages/core/src/calc.ts` — pure, unit-tested. Add a test alongside any new pure function.
- **Workspace packages ship TS source**, not built dist; `apps/web` lists them in `transpilePackages`.
- Feature-folder structure in `apps/web` (`features/<name>/` colocates components + hooks + queries), not by file-type.

## Gotchas

- **Prescription vs session are separate trees.** `routines/routineExercises/routineSets` = the plan; `sessions/sessionExercises/setLogs` = what actually happened. Starting a workout deep-copies the plan into a session, then logs against it. Don't mutate routines to record performed sets.
- **Rest timer is wall-clock, not tick-counting.** `packages/core/src/timer.ts` stores an absolute `endAt`; PWA tabs sleep, so always recompute `remainingMs(state, now)`. Platform layer schedules the service-worker notification for `endAt`.
- **Exercise media is URL-only.** `thumbnailUrl`/`clipUrl` are CDN links, cached-on-view by the service worker — never store binaries in the DB. Logging must never block on media; fall back to thumbnail + text offline.
- **KISS** — no server/AI/abstraction until a real second caller exists. Rule of three before extracting.
- **UI uses Preline** (preferred over native controls). Preline 4 exposes `window.HSStaticMethods` only (no `window.HSSelect`); enhance via `HSStaticMethods.autoInit()`. `globals.css` imports `variants.css` + `@source` by **relative path** (`../../node_modules/preline/...`) because they aren't in Preline's package `exports`. `PrelineInit` re-inits on route change; wrap stateful widgets (see `AdvancedSelect`) and forward the native `change` to React. Inline-styles → Preline/Tailwind migration is in progress (Stats select done first).
- **Identity.** For **writes**, `ownerId` comes from the server — the API route derives it from the JWT `sub` (`withUser` in `lib/api-auth.ts`) and scopes every query by it; never trust a client-supplied `ownerId`. Client-side, `getCurrentUserId()` (`apps/web/src/lib/auth.ts`) still resolves the Supabase user id for local reads/keys. Never hardcode `ownerId`.

## Migrations / data

Schema is the Drizzle schema in `packages/db/src/schema.ts` — keep it in sync with the `@rackd/core` types it mirrors. Migrations: `pnpm --filter @rackd/db db:generate` (writes SQL) then `db:push` (applies to Supabase Postgres via `DATABASE_URL`). The exercise library is seeded once server-side with `pnpm --filter @rackd/db seed` (`src/seed-pg.ts`), not per login.

## Workflow

- Default to Plan mode for non-trivial work; agree on the plan before editing.
- Don't commit or push unless asked. Default branch `main` (remote: `origin`, github.com/iammayron/myfit). For non-trivial work, use a short-lived branch + PR rather than pushing straight to `main`.
- After changes, run the gate (`pnpm typecheck && pnpm test`); verify UI/behavior in the running app when practical.
- If a change added or altered testable behavior with no covering test, write one (pure logic → `packages/core`; repo/route behavior → `packages/db` / `apps/web/test`) — see `/test-author`. When test quality is in doubt, vet for false-positives and missing cases — see `/test-auditor`. Skip for trivial changes (docs, types, UI-only tweaks) with nothing to assert.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
