# FitNow — project rules for Claude Code

Local-first gym workout tracker (plan routines, run workouts, rest timer, history). PWA web first; React Native mobile later sharing the same core. pnpm + Turborepo monorepo, TypeScript strict, Next.js 15 / React 19, Triplit (local-first + sync). Keep changes small, typed, and tested.

## Commands

- `pnpm dev` — run all apps (web on :3000)
- `pnpm --filter @fitnow/web dev` — web only
- `pnpm typecheck` — type check all packages (run before every commit)
- `pnpm test` — run tests (vitest in `@fitnow/core`)
- `pnpm --filter @fitnow/core test` — fast core logic tests
- `pnpm build` — production build

Before committing, run: `pnpm typecheck && pnpm test`.

No formatter/linter is wired yet — the format hook auto-detects and no-ops until one is added. Don't reference a `lint`/`format` script until it actually exists.

## Architecture

Logic lives in `packages/`; apps are thin shells.

- `packages/core` — pure domain logic + **all domain types**. ZERO platform/UI/DB deps. This is what React Native reuses later.
- `packages/db` — Triplit schema + repository functions (the only place that touches the DB client).
- `packages/ui` — design tokens (`tokens.css`) + shared helpers.
- `apps/web` — Next.js App Router PWA.

## Conventions

- **Types live once in `@fitnow/core`** (`src/types.ts`). Import them everywhere; never redeclare a domain shape (DRY).
- **DB access only through `@fitnow/db` repository functions** (`startSession`, `logSet`, `finishSession`, …). UI never calls the Triplit client directly — keeps mutations in one place and the engine swappable.
- **Units stored canonical (kg)**, converted at the display edge via `formatWeight`/`fromKg`. Never store lb.
- **Calculations** (1RM, plates, volume, progression) live in `packages/core/src/calc.ts` — pure, unit-tested. Add a test alongside any new pure function.
- **Workspace packages ship TS source**, not built dist; `apps/web` lists them in `transpilePackages`.
- Feature-folder structure in `apps/web` (`features/<name>/` colocates components + hooks + queries), not by file-type.

## Gotchas

- **Prescription vs session are separate trees.** `routines/routineExercises/routineSets` = the plan; `sessions/sessionExercises/setLogs` = what actually happened. Starting a workout deep-copies the plan into a session, then logs against it. Don't mutate routines to record performed sets.
- **Rest timer is wall-clock, not tick-counting.** `packages/core/src/timer.ts` stores an absolute `endAt`; PWA tabs sleep, so always recompute `remainingMs(state, now)`. Platform layer schedules the service-worker notification for `endAt`.
- **Exercise media is URL-only.** `thumbnailUrl`/`clipUrl` are CDN links, cached-on-view by the service worker — never store binaries in the synced DB. Logging must never block on media; fall back to thumbnail + text offline.
- **KISS** — no server/AI/abstraction until a real second caller exists. Rule of three before extracting.

## Migrations / data

Schema is the Triplit schema in `packages/db/src/schema.ts`. When you change it, keep it in sync with the `@fitnow/core` types it mirrors. No SQL migrations — Triplit handles the local store; sync wiring (server URL + auth) comes in Phase 2.

## Workflow

- Default to Plan mode for non-trivial work; agree on the plan before editing.
- Don't commit or push unless asked. Solo project on `master`, no remote yet — commit directly; switch to short-lived branches + PRs once a GitHub remote exists.
- After changes, run the gate; verify UI/behavior in the running app when practical.
