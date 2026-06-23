# Rackd redesign — adoption plan

Adopt the **Rackd** Claude Design kit (`ui_kits/rackd-app/`, project
`b02424eb-daa9-4880-8097-5539f821e4d3`) into the live app, completely, in phases.

## Context

The kit is a **MyFit → Rackd rebrand + feature expansion**. Two facts shape the work:

1. **The backend is already ahead of the brief.** Domain types + DB repos already
   support RPE, supersets, replace-exercise, PRs (`detectAndRecordPRs`), exercise
   media (`thumbnailUrl`/`clipUrl`/`instructions`), programs + program days, routine
   sharing (`/discover`), and program templates (`cloneProgramTemplate`). Existing
   routes: `/`, `/routines` + `/routines/[id]`, `/programs` + `/programs/[id]`,
   `/history` + `/history/[id]`, `/workout/[id]`, `/discover`, `/settings`. Quick
   ad-hoc workout already ships (dashboard picker → session). So **~70% of the kit is
   restyle + reorganize**, not greenfield.
2. **Do not copy the kit's mock data model.** `data.js` references routines by *name*
   and keys overrides by string — mock convenience. Adopt the kit's **UX**; map it onto
   the real ID-based `@myfit/core` types + `@myfit/db` repos.

Genuinely-new surfaces: exercise **detail page**, **workout summary + share card**,
**save-back diff** flow, **mini-workout bar** (minimize/resume), program **schedules**,
**program-local routine overrides**, dedicated **PRs list**, **muscle visualizer**.

## Decisions (settled)

- **Component layer** → build as shared React components in `packages/ui`; retire
  Preline widget-by-widget. (CLAUDE.md "Preline preferred" is now superseded for any
  widget a DS primitive covers.)
- **Navigation** → adopt the kit's **3 tabs**: Home / Plans / Progress.
- **Package rename** → full `@myfit/*` → `@rackd/*` now (Phase 0).

## Brand deltas (kit vs today)

| | Today (MyFit) | Kit (Rackd) |
|---|---|---|
| Theme | dark-first via `prefers-color-scheme` | **light default** via `[data-theme]` attribute + JS controller |
| Accent | blue `#4f7cff` | **coral `#ff5a3c`** (both themes; `#ff6b4d` on dark) |
| Font | system stack | **Hanken Grotesk** 400–800, `tabular-nums` on metrics |
| Radii | 6/10/16 | 8/12/16/24/28/pill |
| Shadows | flat | soft warm + `--shadow-accent` coral glow |
| Signature | — | **rep ring** (rest timer + logo motif) |

---

## Status

- **Phase 0 — done** (`dd37c39`): tokens, `[data-theme]` + no-FOUC + `useTheme` + Settings toggle, Hanken Grotesk via next/font, manifest/metadata rebrand, `@myfit/*`→`@rackd/*` rename. Storage IDs (`dbName`, localStorage keys) intentionally left as `"myfit"` — renaming orphans local-first data; migrate separately.
- **Phase 1 — done** (`e30d04d`): 12 kit components ported to TSX in `packages/ui`; brand icons regenerated (PNG arc simplified by ImageMagick; SVG source exact).
- **Phase 2 — in progress**: 3-tab nav (Home/Plans/Progress, Settings → header), restyle screens to kit.

## Phases

Each phase is independently shippable. 0 is pure foundation; 5 is the only one needing
schema changes + a sync-server restart.

### Phase 0 — Brand foundations + rename (no behavior change)
- Replace `packages/ui/src/tokens.css` with the full Rackd token set: colors (light
  default + `[data-theme="dark"]`), typography scale + weights + `--num`, effects
  (radii, soft warm shadows, `--shadow-accent`), spacing, motion.
- Theme mechanism: `prefers-color-scheme` media → `[data-theme]` attribute + small JS
  controller (follow OS, manual toggle, persist). Settings gets the toggle.
- Hanken Grotesk `@font-face` (5 woff2 → `public/`); wire `--font-sans`.
- Assets: logo mark/wordmark, maskable icon, `icon-192/512`, `manifest.webmanifest`
  (name/short_name/theme_color/bg), `layout.tsx` metadata. Rebrand "MyFit"→"Rackd"
  strings.
- **Rename** `@myfit/*` → `@rackd/*` across packages + all imports + `transpilePackages`.
- Gate (`pnpm typecheck && pnpm test`); visual sanity light + dark.

### Phase 1 — Rackd component layer (`packages/ui`)
- Build kit primitives as React/Tailwind components: Button, Card, Badge, Avatar,
  Input, SegmentedControl, StatTile, ProgressBar, SelectableRow, TabBar,
  **RestTimerRing** (signature), SetRow.
- Wire RestTimerRing to the existing `timer.ts` FSM (`remainingMs`).
- Add a test alongside any new pure helper.

### Phase 2 — IA / navigation + screen restyle
- 5 tabs → 3: **Home** (`/`), **Plans** (`/programs`, folds in routines + templates),
  **Progress** (`/history`, folds in PRs + weight). Settings via header gear;
  `/discover` → Templates surface.
- Restyle Dashboard to the kit: coral "today's workout" hero, "this week" widget,
  weight-progress + history/streak cards.
- Restyle Routines, Programs, History, Settings onto the new components.

### Phase 3 — Live workout overhaul
- Lift workout state into a shell/provider so it survives navigation → **MiniWorkoutBar**
  (minimize/resume); workout stays mounted, not unmounted.
- **Workout summary** screen on finish (volume, PRs, duration, sets).
- **Save-back diff** flow: performed vs prescription → sheet → numbers / exercises /
  everything. Ship "save everywhere" (shared routine) now; gate "save here" (program
  override) on Phase 5.
- RestTimerRing replaces `RestTimerBar`; per-exercise rest pill + ±15s popover. Expose
  the RPE chip on SetRow (fields already exist).

### Phase 4 — Exercise system
- **Exercise detail page** (route): image/clip, **muscle visualizer** (primary +
  secondary), instructions + cues. Reachable from any exercise name. (Add `cues` to the
  `Exercise` type or fold into `instructions`.)
- Placeholder media: deterministic tinted gradient (kit's `exercisePhoto`) until real
  assets — **flag real-asset need**.
- **One unified Exercise Picker** (similar-by-muscle + full-library search) replacing
  `AddExercisePicker` / `ReplaceExercisePicker`; reused in editor + live workout.
- Restyle the existing quick/ad-hoc workout to the kit's QuickWorkoutScreen.
- Dedicated **PRs list** screen.

### Phase 5 — Programs, schedules, templates, overrides, supersets (schema work)
- Add **schedule** to programs (rotation / weekly maps); Dashboard "today's workout"
  reads it. Program detail screen.
- **Templates** browse + adopt (db fns exist) → copies routines, creates a scheduled
  program.
- **Program-local routine override** (#25): new collection + repo fns (diverge from a
  shared routine without mutating it). Wires save-back "here".
- Make-superset action + connecting line (UI over existing `setRoutineExerciseSuperset`);
  add a `duplicateRoutine` repo fn.
- ⚠️ Schema change → **restart the sync server** (it bakes the schema at startup; see
  CLAUDE.md gotcha).

### Phase 6 — Share
- Summary → shareable **image** (html-to-canvas of a ShareCard) + text via the Web Share
  API. Also reachable from the Progress tab.

### Phase 7 — Polish / PWA / a11y
- Reduced-motion, 2px coral focus rings, 44px-target audit, `tabular-nums` on all
  metrics, service-worker media caching for exercise clips, finalize theme toggle.

## Open flags
- Real exercise photo/video assets (Phase 4) — kit uses placeholder gradients.
- Lucide icon library is a kit *recommendation*, not present in source — confirm before
  adopting.
