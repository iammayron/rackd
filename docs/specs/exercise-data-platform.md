# Exercise Data Platform — End-to-End Plan

**Status:** Plan (approved direction, nothing built yet)
**Owner:** Mayron
**Last updated:** 2026-06-26

---

## 1. Goal

Ship a **big, self-contained fitness database** bundled with rackd so a user who
downloads the app has everything — exercises (info + media + muscle maps), plans,
programs, substitutions — and never needs another app.

This data also becomes the foundation for: exercise replacement, smarter search,
muscle fatigue/recovery tracking, and AI-generated plans/programs.

## 2. Principles (non-negotiable)

1. **We own the data.** Ingest once from openly-licensed sources into our DB. **No
   external API at runtime.** No paid-API dependency to read an exercise.
2. **Offline-first.** Everything must work offline — fits the existing IndexedDB query
   cache + service-worker media caching. Media is URL-only in the DB (never blobs).
3. **Fits the existing stack.** Drizzle → Supabase Postgres; types in `@rackd/core`;
   DB access only through `@rackd/db` repo functions; UI calls `api()` + React Query.
4. **Keep the coarse enums canonical.** Existing app logic depends on the 13-value
   `MuscleGroup`, 8-value `Equipment`, `ExerciseCategory`. The rich layer maps onto them;
   nothing existing breaks.
5. **KISS.** No AI/abstraction until a real caller exists. Derived enrichment is computed
   once into plain columns, not a live service.
6. **Our moat = derived enrichment** (`movementPattern`, per-muscle `activation`, fatigue
   coefficients). No source ships these; we compute and own them.

## 3. Sourcing strategy

| Source | License | Use | Ships in app? |
|---|---|---|---|
| **`yuhonas/free-exercise-db`** | Unlicense (public domain) | Primary base — ~800 exercises, real photos, `force`/`level`/`mechanic`/muscles | ✅ no strings |
| **wger** | exercise DB CC-BY-SA 4.0 | Optional volume + extra media/translations | ✅ with attribution |
| ExerciseDB v2 (AscendAPI) | commercial / RapidAPI | Optional later — 11k exercises + polished video, only if we want premium volume | ⚠️ license first |

**Source links:**
- free-exercise-db: repo https://github.com/yuhonas/free-exercise-db · dataset https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json · images base https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/
- wger: site https://wger.de · API https://wger.de/api/v2/ · docs https://wger.de/en/software/api · source https://github.com/wger-project/wger
- ExerciseDB v2 (AscendAPI): site https://exercisedb.dev · docs https://docs.ascendapi.com · repos https://github.com/ExerciseDB/exercisedb-api + https://github.com/ExerciseDB/muscle-visualizer-api

- **Schema is source-agnostic** (`source` + `sourceId` columns) so any source bolts on
  without rework.
- **Plans/programs: author our own.** Training *methodologies* aren't copyrightable;
  someone's program *text* is. We hand-author templates of proven systems and optionally
  import wger's CC-BY-SA community templates. **No scraping muscleandstrength.com.**

### Media strategy
- **Now:** ship free-exercise-db's real public-domain **photos** (start/end position).
  Anatomically correct, free, zero generation cost.
- **Later (optional polish):** AI-generated demo clips — one consistent stylized look,
  **every clip human-reviewed for form** (wrong form = injury). Never a launch blocker.
- All media **mirrored to our CDN** (Supabase Storage); DB stores our URL + `originalUrl`.

### AI strategy
- **AI plans = core, high ROI.** Plan generation is constraint satisfaction over our
  structured data (muscle coverage, volume, fatigue, equipment, balance). Needs the data
  model first — garbage in, garbage out.
- **AI media = deferred polish.** Real photos now; generated clips later, reviewed.
- Both routes require the same prerequisite: **clean structured exercise data.**

---

## 4. Source data shapes

### free-exercise-db (primary)
```jsonc
{
  "id": "Alternate_Incline_Dumbbell_Curl",
  "name": "Alternate Incline Dumbbell Curl",
  "force": "pull",                 // push | pull | static | null
  "level": "beginner",             // beginner | intermediate | expert
  "mechanic": "isolation",         // compound | isolation | null
  "equipment": "dumbbell",         // or null
  "primaryMuscles": ["biceps"],
  "secondaryMuscles": ["forearms"],
  "instructions": ["...", "..."],
  "category": "strength",
  "images": ["Alternate_Incline_Dumbbell_Curl/0.jpg", ".../1.jpg"]
}
```
- ~800 exercises. Raw base URL: `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/`
- One JSON array (`dist/exercises.json`) + per-exercise image folders.

### wger (optional second source)
- REST API + downloadable DB; fields: name (multilingual), category, equipment, muscles
  (primary/secondary), images, some videos. License CC-BY-SA 4.0 → keep attribution.

### ExerciseDB v2 (optional, later, paid)
- Adds `videoUrl`, `exerciseTips[]`, `variations[]`, `relatedExerciseIds[]`, multilingual,
  11k exercises. Only pursue if premium volume/video is wanted; confirm storage license.

---

## 5. Canonical data model (Drizzle, `packages/db/src/schema.ts`)

Extend the existing `exercises` table; add the rich layer around it. Types mirrored in
`@rackd/core` per project rules.

### 5.1 `exercises` (extend existing)
Existing columns kept: `id, name, primaryMuscle, secondaryMuscles[], equipment, category,
instructions, formCues[], thumbnailUrl, clipUrl, clipUrlWebm, mediaSource, isCustom, ownerId`.

Add:
```
source           text   not null default 'rackd'   -- 'free-exercise-db' | 'wger' | 'exercisedb' | 'rackd'
sourceId         text                              -- original id from the source
slug             text   unique                     -- url-safe
force            text                              -- 'push' | 'pull' | 'static'
level            text                              -- 'beginner' | 'intermediate' | 'expert'
mechanic         text                              -- 'compound' | 'isolation'
movementPattern  text                              -- DERIVED: squat|hinge|lunge|push|pull|carry|core|isolation
isUnilateral     boolean not null default false    -- DERIVED
bodyPart         text                              -- 'upper' | 'lower' | 'core' | 'full'
aliases          text[] not null default '{}'      -- search synonyms
popularity       integer not null default 0        -- for ranking/search
```

### 5.2 `muscles` — fine-grained taxonomy
```
id             text primary key      -- 'lats', 'rectus_femoris', ...
name           text not null
canonicalGroup text not null         -- → MuscleGroup (13-value enum)
region         text                  -- 'upper' | 'lower' | 'core'
svgRegion      text                  -- path id in our MuscleMap SVG
recoveryHours  integer not null default 48  -- baseline recovery time (fatigue engine)
```

### 5.3 `exercise_muscles` — exercise ↔ muscle join (with activation)
```
exerciseId   text references exercises(id)
muscleId     text references muscles(id)
role         text not null         -- 'primary' | 'secondary' | 'tertiary'
activation   real not null         -- DERIVED 0..1 (primary 1.0 / secondary 0.5 / tertiary 0.25 v1)
primary key (exerciseId, muscleId)
```

### 5.4 `exercise_media`
```
id           text primary key
exerciseId   text references exercises(id)
kind         text not null         -- 'image' | 'thumbnail' | 'gif' | 'video' | 'muscle_map'
url          text not null         -- OUR CDN url
originalUrl  text                  -- source url (provenance)
width        integer
height       integer
order        integer not null default 0
lang         text                  -- for future i18n
```

### 5.5 `exercise_relations` — similarity / substitution graph
```
exerciseId   text references exercises(id)
relatedId    text references exercises(id)
kind         text not null         -- 'variation' | 'similar' | 'substitute'
score        real not null         -- 0..1
reason       text                  -- human-readable ("same primary muscle, dumbbell alt")
primary key (exerciseId, relatedId, kind)
```

### 5.6 Lookup tables
```
equipment_map: sourceValue text → canonical text (Equipment enum)
muscle_map:    sourceValue text → muscleId text     -- reconcile source muscle strings
```

### 5.7 Plans / programs (separate from user `routines`)
```
program_templates
  id, slug, name, description, goal, level, methodology ('PPL'|'5/3/1'|...),
  daysPerWeek, durationWeeks, equipmentNeeded text[], source, attribution, isPublic

program_days
  id, programId, weekIndex (nullable), dayIndex, label  -- e.g. 'Push A'

program_day_exercises
  id, dayId, exerciseId, order, sets, repScheme text ('8-12' | '5,5,5,5,1'),
  restSeconds, intensity ('RPE 8' | '75% 1RM' | null), notes, sourceName
```

### 5.8 Fatigue (user-scoped, owner_id)
```
muscle_fatigue
  ownerId, muscleId, accumulatedLoad real, lastTrainedAt timestamptz
  primary key (ownerId, muscleId)
-- freshness computed on read, wall-clock; nothing tick-counted
```

### 5.9 AI / search (later)
```
exercise_embeddings   -- pgvector: exerciseId, embedding vector(N)
```

---

## 6. Core types (`packages/core/src/types.ts`)

Add (mirror schema, types live once here):
```ts
export type Force = "push" | "pull" | "static";
export type Level = "beginner" | "intermediate" | "expert";
export type Mechanic = "compound" | "isolation";
export type MovementPattern =
  | "squat" | "hinge" | "lunge" | "push" | "pull" | "carry" | "core" | "isolation";
export type MuscleRole = "primary" | "secondary" | "tertiary";

export interface MuscleInvolvement { muscleId: string; role: MuscleRole; activation: number; }
export interface ExerciseRelation { relatedId: string; kind: "variation" | "similar" | "substitute"; score: number; reason?: string; }
// extend existing Exercise with: source, sourceId, slug, force?, level?, mechanic?,
// movementPattern?, isUnilateral, bodyPart?, aliases, muscles: MuscleInvolvement[]
```

---

## 7. Fine → coarse mapping

Source vocabularies are wide; the app uses 13 `MuscleGroup` + 8 `Equipment`. `muscle_map`
and `equipment_map` hold the reconciliation. The app reads canonical coarse fields
(`primaryMuscle`, `equipment`) so existing UI/stats/timer keep working; detail pages + AI
read the fine `exercise_muscles` rows. One reviewed mapping = source of truth. **Unmapped
values are logged for manual triage, never silently dropped.**

---

## 8. Derived enrichment (our moat — computed once at ingest)

| Field | How derived |
|---|---|
| `movementPattern` | Rule map from name + primary muscle + `mechanic` (e.g. "squat"/"press"/"row"/"curl" keywords → pattern). Manual override table for edge cases. |
| `isUnilateral` | Name keywords ("single-arm", "alternate", "split", "lunge", "pistol", "bulgarian"). |
| `activation` | Role heuristic v1: primary 1.0 / secondary 0.5 / tertiary 0.25. Tunable table. |
| `bodyPart` | From primary muscle's region. |
| `aliases` | Curated synonym list per common exercise (search). |

These power §10–§13. Stored as plain columns/rows — no runtime computation.

---

## 9. Substitution / similarity graph

Populate `exercise_relations`:
- **`similar`** (the "Similar exercises" UI list): same `canonicalGroup` primary muscle.
  Score by overlap of (primary+secondary muscles, Jaccard) and equipment availability.
- **`variation`**: same `movementPattern` + primary muscle, different equipment.
- **`substitute`** (used by replacement feature): same primary muscle + same
  `movementPattern` + compatible equipment + similar `activation` profile.
- Served by `GET /api/exercises/:id/substitutes?equipment=...` → ranked, filterable to the
  user's available equipment. This is the "swap exercise" action.

---

## 10. Muscle map — self-owned SVG (no external API)

- Front+back **SVG body map**, each muscle region a named path keyed to `MuscleGroup` /
  `muscles.svgRegion`.
- `<MuscleMap primary secondary tertiary />` fills regions from `exercise_muscles`. Fills
  from `tokens.css` (primary = accent, secondary = muted, tertiary = faint), dark-mode aware.
- Source: `react-body-highlighter` (MIT) used/forked, or an open anatomical SVG tagged by us.
- Free, offline, instant, themeable. **No external visualizer API, no muscle-id bridge.**

---

## 11. Exercise detail page — render contract

Top → bottom (from the mocks):
1. **Media**: short GIF/video loop + poster thumbnail (real photo today). Replaces the
   initials placeholder once media exists.
2. **Title** + **mechanic badge** (Compound/Isolation).
3. **Tags**: primary muscle group + equipment.
4. **Muscles worked**: `<MuscleMap>` + bars for primary / secondary / tertiary; bar length
   = `activation`.
5. **How to perform**: numbered `instructions[]`.
6. **Form cues**: `formCues` / `exerciseTips[]`.
7. **Variations** (same move, different equipment) and **Similar exercises** (same muscle):
   two lists from `exercise_relations`; each row = name + muscle · equipment.

Stored but not all shown (power search/AI): `force`, `level`, `bodyPart`, `isUnilateral`,
`movementPattern`, `aliases`.

---

## 12. Muscle fatigue / recovery engine

Powers "tiredness %", rest guidance, "what to train today", AI plans.
1. **Activation weights** — `exercise_muscles.activation` (§8).
2. **Accrual** — per logged set: `fatigue[muscle] += volume(sets×reps×load) × activation`,
   updates `muscle_fatigue.accumulatedLoad` + `lastTrainedAt`.
3. **Recovery decay** — exponential, **wall-clock** (`freshness(muscle, now)` recomputed on
   read, never tick-counted — same rule as the rest timer). Larger muscles decay slower via
   `muscles.recoveryHours`.
4. **Freshness %** drives recovery warnings, "train the freshest" suggestions, auto-deload.

Adjacent: weekly volume/muscle vs landmarks (MEV/MAV/MRV), push/pull & upper/lower balance
(`force`+`bodyPart`), equipment-aware planning, progression/weak-point coaching.

---

## 13. Plans, programs & AI

- **Templates** authored in `program_templates*` (PPL, Upper/Lower, Full Body, 5/3/1,
  Starting Strength, GZCLP, nSuns, PHUL, PHAT). Users clone a template into their own
  `routines`. Also the few-shot exemplars for AI.
- **AI plan generation** (later): inputs = goal, days/week, equipment, experience, current
  fatigue, volume landmarks; output = a `program_template` validated against our exercise
  DB. LLM call lives in `@rackd/db`/route layer, never the request path until a real feature.
- **pgvector embeddings** over `name + instructions + muscles + movementPattern` for
  semantic search and substitution.

---

## 14. Scripts & tooling (the build deliverables)

All under `packages/db/src/ingest/`, runnable like the existing `seed-pg.ts`. Idempotent,
resumable, `--dry-run` + `--limit` supported, structured logging + a summary report.

| Script | Command | Purpose |
|---|---|---|
| `fetch-source.ts` | `pnpm --filter @rackd/db ingest:fetch -- --source=free-exercise-db` | Download the raw source dataset JSON to a local cache dir. |
| `build-mappings.ts` | `pnpm --filter @rackd/db ingest:mappings` | Generate/refresh `muscle_map` + `equipment_map`; print unmapped values for manual review. |
| `seed-exercises.ts` | `pnpm --filter @rackd/db ingest:exercises -- --source=free-exercise-db` | Normalize + upsert exercises, `exercise_muscles`, instructions; map fine→coarse. Upsert by `(source, sourceId)`. |
| `download-media.ts` | `pnpm --filter @rackd/db ingest:media` | Download each image/clip from source, dedupe by content hash, upload to Supabase Storage, write `exercise_media` (our URL + `originalUrl`). Concurrency-limited + retry/backoff. Resumable via checkpoint. |
| `enrich.ts` | `pnpm --filter @rackd/db ingest:enrich` | Compute `movementPattern`, `isUnilateral`, `bodyPart`, `activation`; apply override tables. |
| `build-relations.ts` | `pnpm --filter @rackd/db ingest:relations` | Compute `exercise_relations` (similar/variation/substitute) + scores. |
| `seed-programs.ts` | `pnpm --filter @rackd/db ingest:programs` | Insert authored `program_templates*` from `data/programs/*.json`. |
| `merge-source.ts` | `pnpm --filter @rackd/db ingest:merge -- --source=wger` | Dedupe a second source against existing exercises (fuzzy name + muscle match); merge or insert. |
| `embed.ts` (later) | `pnpm --filter @rackd/db ingest:embed` | Generate pgvector embeddings. |

One-shot orchestrator: `pnpm --filter @rackd/db ingest:all` runs fetch → mappings →
exercises → media → enrich → relations → programs in order.

**Env:** `DATABASE_URL` (existing), `SUPABASE_SERVICE_ROLE_KEY` + storage bucket creds
(media upload). No RapidAPI keys unless/until ExerciseDB is licensed.

**Local cache dir:** `packages/db/.cache/ingest/` (gitignored) for downloaded source data.

---

## 15. API routes (scaffold with `/add-endpoint`, owner-scoped where user data)

- `GET /api/exercises` — list/search (filters: muscle, equipment, mechanic, level,
  movementPattern, force, query). Public library.
- `GET /api/exercises/:id` — full detail (joins muscles, media, relations).
- `GET /api/exercises/:id/substitutes?equipment=...` — ranked substitutes.
- `GET /api/programs` / `GET /api/programs/:id` — template library.
- `POST /api/programs/:id/clone` — clone template into the user's `routines` (owner-scoped).
- `GET /api/fatigue` — per-muscle freshness for the current user (owner-scoped).

Client: React Query hooks in `apps/web/src/features/exercises/` + `features/programs/`,
keys in the central `qk` registry; cache persists to IndexedDB for offline reads.

---

## 16. Offline / PWA

- Exercise + program libraries are world-readable; cache aggressively in IndexedDB.
- Media is URL-only; service worker caches on view (existing pattern). Logging never blocks
  on media — fall back to thumbnail + text.
- Consider a one-time "download library" action to warm the SW cache for full offline use.

---

## 17. Phasing / milestones

| Phase | Deliverable | Ships value |
|---|---|---|
| **0** | Schema migration + `@rackd/core` types + lookup tables | foundation |
| **1** | `<MuscleMap>` SVG component + exercise detail page (works on current data) | visible win |
| **2** | `fetch` + `build-mappings` + `seed-exercises` (free-exercise-db) | ~800 owned exercises |
| **3** | `download-media` → Supabase Storage | real photos in app, offline |
| **4** | `enrich` (movementPattern/activation/etc.) | powers everything downstream |
| **5** | `build-relations` + `/substitutes` endpoint + UI swap | replacement feature |
| **6** | `seed-programs` (authored templates) + clone-to-routine | bundled plans |
| **7** | Fatigue engine (accrual + freshness) | "tiredness %", rest guidance |
| **8** | `merge-source` (wger) | more volume/media |
| **9** | pgvector embeddings + AI plan generation | AI features |
| **10** | (optional) AI-generated demo media, reviewed | polish |

Each phase: small, typed, tested (pure logic → `@rackd/core`; repo/route → `@rackd/db`/
`apps/web`). Run the gate (`pnpm typecheck && pnpm test`) before commits. Short-lived
branch + PR per phase.

---

## 18. Requirements checklist

- [ ] Migration extends `exercises` + adds `muscles`, `exercise_muscles`, `exercise_media`,
      `exercise_relations`, `equipment_map`, `muscle_map`, `program_templates*`,
      `muscle_fatigue`.
- [ ] `@rackd/core` types updated; no domain shape redeclared elsewhere.
- [ ] Ingest scripts: idempotent, resumable, `--dry-run`/`--limit`, summary report.
- [ ] Media mirrored to Supabase Storage; DB stores our URL + provenance; no blobs in DB.
- [ ] Coarse enums stay canonical; existing UI/stats/timer unaffected.
- [ ] Attribution stored for CC-BY-SA sources (wger) and surfaced where required.
- [ ] `<MuscleMap>` themeable + dark-mode + offline.
- [ ] `/substitutes` filters to user equipment.
- [ ] Fatigue freshness is wall-clock, recomputed on read.
- [ ] Tests: enrichment rules, mapping, relation scoring (core); seed/merge/route (db/web).

## 19. Risks & open questions

- **Media volume/quality:** open base ≈ photos, not 11k polished gifs. Accept for v1;
  revisit AI-gen or licensing for premium video.
- **Activation weights** are heuristic v1; refine with a real activation reference later.
- **`movementPattern` derivation** needs a manual override pass for odd names.
- **wger merge dedupe** — fuzzy matching will need a review pass.
- **AI plan quality** depends on enrichment completeness — sequence accordingly.
- Multilingual now or English-only v1? (schema has `lang`, default English.)

## 20. Appendix — example normalized record

```jsonc
{
  "id": "barbell-row",
  "source": "free-exercise-db",
  "sourceId": "Barbell_Row",
  "name": "Barbell Row",
  "slug": "barbell-row",
  "primaryMuscle": "back",          // canonical
  "secondaryMuscles": ["biceps"],   // canonical
  "equipment": "barbell",
  "category": "barbell",
  "force": "pull",
  "level": "intermediate",
  "mechanic": "compound",
  "movementPattern": "pull",        // derived
  "bodyPart": "upper",              // derived
  "isUnilateral": false,            // derived
  "instructions": ["Hinge to ~45°...", "Row to lower ribs.", "Lower under control."],
  "formCues": ["Pull with the elbows", "Keep torso angle fixed", "Squeeze the back"],
  "muscles": [
    { "muscleId": "lats", "role": "primary",   "activation": 1.0 },
    { "muscleId": "rhomboids", "role": "secondary", "activation": 0.5 },
    { "muscleId": "biceps", "role": "secondary", "activation": 0.5 }
  ],
  "media": [{ "kind": "image", "url": "https://cdn.rackd.../barbell-row/0.jpg", "originalUrl": "https://raw.githubusercontent.com/..." }],
  "relations": [
    { "relatedId": "pendlay-row", "kind": "variation", "score": 0.9, "reason": "same pull pattern, barbell" },
    { "relatedId": "seated-cable-row", "kind": "similar", "score": 0.8, "reason": "same primary muscle (back)" }
  ]
}
```
