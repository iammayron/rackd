# FitNow

Local-first gym workout tracker. Plan routines, run workouts, rest timer, history.
PWA web first; React Native mobile later sharing the same core.

## Architecture

Monorepo (pnpm + Turborepo). Business logic lives in `packages/`; apps are thin shells.

```
apps/
  web/        Next.js PWA (ships first)
packages/
  core/       Pure domain logic + types — ZERO platform deps (the DRY source of truth)
  db/         Triplit schema + repository (local-first + cloud sync)
  ui/         Design tokens + shared UI helpers
```

## Principles

- **KISS** — simplest thing that runs the workout loop. No server/AI/abstractions
  until a real second caller exists. Rule of three before extracting.
- **DRY** — domain types live once in `@fitnow/core`; everything imports them.
  One `estimate1RM`, one `formatWeight`, one timer FSM, schema-first types.
- **Local-first** — write local, sync in background. Offline is invisible.
  Media (exercise clips) are CDN URLs, never in the sync DB.

## Develop

```bash
pnpm install
pnpm dev          # all apps
pnpm test         # core unit tests
pnpm typecheck
```

## Roadmap

1. Core loop: routine editor → active workout + rest timer → history (MVP)
2. Progression + analytics + cloud sync
3. Programs (multi-week)
4. Social + AI suggestions
