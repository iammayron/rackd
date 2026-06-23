# MyFit — project rules for Claude Code

Local-first gym workout tracker (plan routines, run workouts, rest timer, history). PWA web first; React Native mobile later sharing the same core. pnpm + Turborepo monorepo, TypeScript strict, Next.js 15 / React 19, Triplit (local-first + sync). Keep changes small, typed, and tested.

## Commands

- `pnpm dev` — run all apps (web on :3000)
- `pnpm --filter @myfit/web dev` — web only
- `pnpm typecheck` — type check all packages (run before every commit)
- `pnpm test` — run tests (vitest in `@myfit/core`)
- `pnpm --filter @myfit/core test` — fast core logic tests
- `pnpm build` — production build

Before committing, run: `pnpm typecheck && pnpm test`.

### Auth (self-hosted Supabase)

- `supabase start` runs the local stack; `supabase status -o env` prints keys.
- **Supabase defaults to ES256 JWTs; Triplit only verifies HS256/RS256.** So we
  use an **RS256** signing key: `supabase gen signing-key --algorithm RS256`
  → wrap as a JSON array in `supabase/signing_keys.json` (gitignored, private) →
  `signing_keys_path` in `config.toml` → restart Supabase.
- The sync server validates Supabase user tokens via `SUPABASE_JWT_SECRET` = the
  **RS256 public JWK** (from `/auth/v1/.well-known/jwks.json`, single key object).
- Web env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- After login, `AuthProvider` calls `client.startSession(accessToken)`; the app is
  auth-gated (no anonymous use). `getCurrentUserId()` = Supabase user id.
- Permissions: every collection is owner-scoped (`ownerId == token.sub`); the
  exercise library is read/insert-open (allow-all filter = `[["id","isDefined",true]]`;
  `{}` or `filter:[]` mean DENY in Triplit). Switching signing keys invalidates
  existing sessions — sign out/in to get a token under the new key.

### Cloud sync (optional, self-hosted)

- `pnpm --filter @myfit/sync start` — run the Triplit sync server (env `JWT_SECRET`, `PORT` default 8787, `STORAGE` sqlite|memory).
- `pnpm --filter @myfit/sync gen-token "$JWT_SECRET" service` — mint a token.
- Enable in the web app by setting `NEXT_PUBLIC_TRIPLIT_URL` + `NEXT_PUBLIC_TRIPLIT_TOKEN` in `apps/web/.env.local` (unset = local-only). `NEXT_PUBLIC_*` is baked at build → rebuild after changing.
- Deploy: `docker compose up -d` on a home box, expose over Tailscale. See `.env.example`.

No formatter/linter is wired yet — the format hook auto-detects and no-ops until one is added. Don't reference a `lint`/`format` script until it actually exists.

## Architecture

Logic lives in `packages/`; apps are thin shells.

- `packages/core` — pure domain logic + **all domain types**. ZERO platform/UI/DB deps. This is what React Native reuses later.
- `packages/db` — Triplit schema + repository functions (the only place that touches the DB client).
- `packages/ui` — design tokens (`tokens.css`) + shared helpers.
- `apps/web` — Next.js App Router PWA.

## Conventions

- **Types live once in `@myfit/core`** (`src/types.ts`). Import them everywhere; never redeclare a domain shape (DRY).
- **DB access only through `@myfit/db` repository functions** (`startSession`, `logSet`, `finishSession`, …). UI never calls the Triplit client directly — keeps mutations in one place and the engine swappable.
- **Units stored canonical (kg)**, converted at the display edge via `formatWeight`/`fromKg`. Never store lb.
- **Calculations** (1RM, plates, volume, progression) live in `packages/core/src/calc.ts` — pure, unit-tested. Add a test alongside any new pure function.
- **Workspace packages ship TS source**, not built dist; `apps/web` lists them in `transpilePackages`.
- Feature-folder structure in `apps/web` (`features/<name>/` colocates components + hooks + queries), not by file-type.

## Gotchas

- **Prescription vs session are separate trees.** `routines/routineExercises/routineSets` = the plan; `sessions/sessionExercises/setLogs` = what actually happened. Starting a workout deep-copies the plan into a session, then logs against it. Don't mutate routines to record performed sets.
- **Rest timer is wall-clock, not tick-counting.** `packages/core/src/timer.ts` stores an absolute `endAt`; PWA tabs sleep, so always recompute `remainingMs(state, now)`. Platform layer schedules the service-worker notification for `endAt`.
- **Exercise media is URL-only.** `thumbnailUrl`/`clipUrl` are CDN links, cached-on-view by the service worker — never store binaries in the synced DB. Logging must never block on media; fall back to thumbnail + text offline.
- **KISS** — no server/AI/abstraction until a real second caller exists. Rule of three before extracting.
- **Sync server needs the schema baked in.** `apps/sync` starts Triplit with `dbOptions.schema` (`{ collections: schema }`). Without it, relational `.Include()` queries fail to sync (`InvalidQueryInclusionError` — "inclusion was: null") even though they work locally. The client `syncSchema` option alone is not enough. **After changing the schema (new collections/fields), restart the sync server** — it bakes the schema at startup, else it rejects the new collection (`InvalidCollectionNameError`). Local-only mode is unaffected.
- **UI uses Preline** (preferred over native controls). Preline 4 exposes `window.HSStaticMethods` only (no `window.HSSelect`); enhance via `HSStaticMethods.autoInit()`. `globals.css` imports `variants.css` + `@source` by **relative path** (`../../node_modules/preline/...`) because they aren't in Preline's package `exports`. `PrelineInit` re-inits on route change; wrap stateful widgets (see `AdvancedSelect`) and forward the native `change` to React. Inline-styles → Preline/Tailwind migration is in progress (Stats select done first).
- **Identity** flows through `getCurrentUserId()` (`apps/web/src/lib/auth.ts`) — persisted anon id today, swap to real auth later. Never hardcode `ownerId`. No per-user permission rules yet (service token = full access); add Triplit roles before multi-user.

## Migrations / data

Schema is the Triplit schema in `packages/db/src/schema.ts`. When you change it, keep it in sync with the `@myfit/core` types it mirrors. No SQL migrations — Triplit handles the local store; sync wiring (server URL + auth) comes in Phase 2.

## Workflow

- Default to Plan mode for non-trivial work; agree on the plan before editing.
- Don't commit or push unless asked. Default branch `main` (remote: `origin`, github.com/iammayron/myfit). For non-trivial work, use a short-lived branch + PR rather than pushing straight to `main`.
- After changes, run the gate; verify UI/behavior in the running app when practical.
