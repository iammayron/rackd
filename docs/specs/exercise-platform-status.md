# Exercise Data Platform — status & handoff

**As of:** 2026-06-27 · **Companion to:** [`exercise-data-platform.md`](./exercise-data-platform.md) (the full plan)

Quick, current snapshot of what's shipped, what's in flight, and how to continue.
The plan doc is the _design_; this doc is the _progress_.

---

## TL;DR

The exercise data platform's foundation is **live in prod**: 873 exercises (public-domain
`free-exercise-db`) with fine muscle data, an anatomical muscle map, a standalone
Exercises tab, and a polished exercise-detail page. Remaining: mirror media to our own
CDN, unify the search/filter UI, "add to routine" from the library, and the bigger
features (fatigue engine, more sources, AI).

---

## Done & merged (on `main`, deployed)

| PR  | What                                                                                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #31 | Schema migration 0004 (additive); `@rackd/core` types; pure ingest layer (taxonomy, mapping, `normalizeFreeExercise`, derivations) + tests; `@rackd/db` ingest scripts; `MuscleMap` anatomical SVG (vendored from react-body-highlighter, MIT); upgraded `suggestReplacements`. **Plan doc.** Migration applied to prod; **873 exercises / 2583 muscle links / 1746 media seeded.** |
| #32 | `getExerciseDetail` joins fine muscles (+ activation) + media; detail page shows real muscle names + activation bars; section reorder.                                                                                                                                                                                                                                              |
| #33 | Hero media: drop separate Demonstration strip, tap-to-fullscreen, and **loop the start/end photos as a faux demo clip**.                                                                                                                                                                                                                                                            |
| #34 | Smoother demo cross-fade (700ms ease) + tap-to-open **lightbox** (works on iOS).                                                                                                                                                                                                                                                                                                    |
| #35 | Routine-editor fixes: **back → routines** (not Plans/programs tab), **dedupe** the add-exercise picker (already-added shown as "Added"), **pull-down-to-close** bottom sheets, and use the **shared Button** for the stray Add-exercise / Save CTAs.                                                                                                                                |
| #36 | **Standalone Exercises tab** (4th bottom tab) — searchable, filterable (muscle + equipment) library → exercise detail.                                                                                                                                                                                                                                                              |

Also on `main` (separate work): a `program-templates` API route + Plans "templates"
browsing — i.e. **Phase 6 is partially started**.

### What a user sees now

- A new **Exercises** tab to browse/search/filter the whole library.
- Exercise detail with: looping photo demo (tap → fullscreen), Compound/Isolation badge,
  muscle + equipment tags, **anatomical muscle map + activation-weighted bars**, how-to,
  form cues (original lifts only), similar exercises, Est-1RM/volume charts.
- No duplicate exercises when adding to a routine/workout.

---

## In flight / next up (no PR yet)

1. **Unify exercise filtering** (agreed, not built). Extract a shared
   `useExerciseFilter(exercises)` hook + `<ExerciseFilterBar>` (search + muscle +
   equipment chips) and apply across **AddExercisePicker**, **ReplaceExercisePicker**, and
   the **Exercises page** so filtering is identical everywhere. Replace picker keeps its
   "Similar / All" grouping; Add picker keeps dedupe.
2. **Add-to-routine from the Exercises page**. A multi-select target picker: choose one or
   more routines to append the exercise to. Programs referencing those routines inherit it
   (shared-by-reference). _Forks are independent copies and untracked_ — see "Open
   decisions". v1 = manual multi-select.

---

## Left to build (from the plan)

| Phase                   | State / note                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 — media mirror        | `ingest:media` written; **not yet run.** Photos still hotlink GitHub. Run once against Tigris (creds already set).                                                                                                                                                                                                                                                                                  |
| 4 — enrich extras       | `movementPattern`/`activation`/`isUnilateral`/`bodyPart` done at seed. **Not done:** `aliases`, `popularity`, curated form cues for popular lifts, a movementPattern override pass.                                                                                                                                                                                                                 |
| 6 — program templates   | **Partially started** (API + Plans browsing exist). Finish: authored templates + clone-to-routine.                                                                                                                                                                                                                                                                                                  |
| 7 — **fatigue engine**  | Not started. `muscle_fatigue` table exists, empty. Per-muscle freshness from logged sets, wall-clock decay → "what to train today" / recovery warnings. The headline feature.                                                                                                                                                                                                                       |
| 8a — **legacy dedup**   | Tooling **built** (`ingest:dedup-legacy` + pure matcher in `@rackd/core`, tests). **Not yet run.** **Visible now:** duplicate exercises (e.g. original `ex_bench_press` _and_ imported "Barbell Bench Press"). Run `--dry-run`, review the 44-row match table, fill `LEGACY_OVERRIDES` for weak matches, then run for real to repoint history onto the rich import and delete the bare `ex_*` rows. |
| 8b — wger import        | **Dropped.** wger's DB is CC-BY-SA (copyleft + attribution), and free-exercise-db already covers volume. Revisit only if a real need for more exercises/media appears.                                                                                                                                                                                                                              |
| 9 — pgvector / AI plans | Not started.                                                                                                                                                                                                                                                                                                                                                                                        |
| 10 — AI demo media      | Deferred by design.                                                                                                                                                                                                                                                                                                                                                                                 |

---

## How to proceed

### Branch / PR flow

- Personal repo `iammayron/rackd` → use plain **`gh`** (not `ghw`).
- Short-lived branch off `main` → PR. **Merging auto-deploys to Fly (prod)** via GitHub
  Actions — Mayron merges PRs himself (assistant is blocked from prod merges).
- Gate before commit: `pnpm typecheck && pnpm --filter @rackd/core test`.

### Data / DB (all prod — there is no local DB configured)

Env lives in `.env` (DB + Tigris S3). Run with env loaded, e.g.:

```bash
set -a && . ./.env && set +a && <command>
```

- Apply migrations: `pnpm --filter @rackd/db db:deploy`
- Seed/refresh exercises (idempotent): `pnpm --filter @rackd/db ingest:all`
- **Mirror media to Tigris (pending):** `pnpm --filter @rackd/db ingest:media`
  (smoke test first: `… ingest:media -- --limit=20`)
- **Legacy dedup (pending):** `pnpm --filter @rackd/db ingest:dedup-legacy -- --dry-run`
  prints the 44-row `ex_*` → import match table + per-row reference counts and
  writes nothing. Review it; for any weak/wrong match add an entry to
  `LEGACY_OVERRIDES` (`packages/core/src/legacy-dedup.ts`). Then run without
  `--dry-run` to repoint routines/sessions/PRs/templates onto the rich import
  and delete the bare legacy rows. Idempotent; only deletes a legacy row once it
  has an applicable match **and** zero remaining references.

### Recommended order from here

1. Run `ingest:media` (own the images).
2. Build **shared filtering** (#1 above) — one PR.
3. Build **add-to-routine** from Exercises (#2) — one PR.
4. **Dedup** import vs original library (Phase 8 slice).
5. **Fatigue engine** (Phase 7).

---

## Open decisions

- **Fork inheritance.** Mayron wants library edits to reach "programs using that routine,
  even forked ones." Forks are _independent untracked copies_ today (`duplicateRoutine`
  stores no parent), so auto-targeting forks isn't possible without adding a
  `sourceRoutineId` lineage column (small migration) + populating it on duplicate/save-back.
  Interim: explicit multi-select covers it manually.

## Key gotchas (carry-over)

- Coarse `MuscleGroup` (13) / `Equipment` (8) enums stay canonical; the fine layer maps
  onto them. Don't break existing UI/stats/timer.
- Media is URL-only in the DB (never binaries). Logging never blocks on media.
- Fatigue freshness must be **wall-clock**, recomputed on read (same rule as the rest timer).
- Types live once in `@rackd/core`; DB access only via `@rackd/db` repo fns from API routes.
