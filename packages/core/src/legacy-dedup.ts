import type { MuscleGroup } from "./types";

/**
 * Legacy-library dedup matcher (see docs/specs/exercise-platform-status.md, Phase 8).
 *
 * The original hand-written seed (44 exercises, ids `ex_*`, source `rackd`) now
 * overlaps the imported free-exercise-db library (slug ids, rich muscle/media
 * data). A user's routines/sessions/PRs still point at the bare `ex_*` rows.
 * This module decides, per legacy exercise, which imported exercise should
 * absorb it — so the DB script can repoint history then delete the old row.
 *
 * Pure + unit-tested. The DB layer supplies candidates and applies the result.
 */

/** Minimal shape needed to match — both legacy and imported rows provide it. */
export interface MatchExercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  /** 'rackd' for the legacy seed; the dataset name for imports. */
  source: string;
}

export type MatchConfidence = "exact" | "strong" | "weak" | "none";

export interface LegacyMatch {
  legacyId: string;
  /** Imported exercise to absorb this legacy one, or null when unresolved. */
  targetId: string | null;
  targetName?: string;
  confidence: MatchConfidence;
  /** 0..1 name+muscle similarity (1 = override or exact normalized-name match). */
  score: number;
  via: "override" | "auto" | "none";
}

/**
 * Authoritative legacy `ex_*` id → imported exercise id (slug). The original
 * hand-written seed (44 `ex_*` rows) is fully superseded by the free-exercise-db
 * import; every legacy id maps to its rich equivalent here. Used two ways:
 *   1. `dedup-legacy-exercises` treats these as ground-truth overrides when
 *      repointing history off the bare legacy rows.
 *   2. `@rackd/db`'s built-in program templates resolve their exercise ids
 *      through this map, so the catalog references real imports (the legacy
 *      rows no longer exist).
 * All targets verified to exist in free-exercise-db. Where the auto-matcher
 * would pick a wrong variant (flat→incline bench, pull-up→band-assisted,
 * leg-ext→single-leg), the curated target wins.
 */
export const LEGACY_EXERCISE_MAP: Record<string, string> = {
  // Chest / push
  ex_bench_press: "barbell-bench-press-medium-grip",
  ex_db_bench_press: "dumbbell-bench-press",
  ex_incline_db_press: "incline-dumbbell-press",
  ex_cable_chest_fly: "cable-crossover", // not a cable PRESS
  ex_ohp: "barbell-shoulder-press",
  ex_db_shoulder_press: "dumbbell-shoulder-press",
  ex_lateral_raise: "side-lateral-raise",
  ex_cable_lateral_raise: "cable-seated-lateral-raise",
  ex_reverse_pec_deck: "reverse-machine-flyes",
  ex_face_pull: "face-pull",
  // Triceps
  ex_tricep_pushdown: "triceps-pushdown",
  ex_bb_overhead_tricep_ext: "standing-overhead-barbell-triceps-extension",
  ex_overhead_cable_tricep_ext: "cable-rope-overhead-triceps-extension",
  ex_db_skullcrusher: "lying-dumbbell-tricep-extension",
  // Back / pull
  ex_pullup: "pullups", // not band-assisted
  ex_lat_pulldown: "wide-grip-lat-pulldown",
  ex_bb_row: "bent-over-barbell-row",
  ex_seated_row: "seated-cable-rows",
  ex_single_arm_db_row: "one-arm-dumbbell-row",
  ex_straight_arm_pulldown: "straight-arm-pulldown",
  ex_deadlift: "barbell-deadlift",
  ex_sumo_deadlift: "sumo-deadlift",
  ex_rdl: "romanian-deadlift",
  // Biceps
  ex_bb_curl: "barbell-curl",
  ex_db_curl: "dumbbell-bicep-curl",
  ex_hammer_curl: "hammer-curls",
  ex_incline_db_curl: "incline-dumbbell-curl",
  ex_cable_curl: "standing-biceps-cable-curl",
  // Legs
  ex_squat: "barbell-squat", // "Barbell Back Squat"
  ex_front_squat: "front-barbell-squat",
  ex_hack_squat: "hack-squat",
  ex_bulgarian_split_squat: "split-squat-with-dumbbells", // nearest import
  ex_leg_press: "leg-press",
  ex_leg_ext: "leg-extensions", // not single-leg
  ex_leg_curl: "lying-leg-curls", // not the SEATED curl
  ex_hip_thrust: "barbell-hip-thrust",
  ex_calf_raise: "standing-calf-raises",
  ex_seated_calf_raise: "seated-calf-raise",
  // Core
  ex_plank: "plank",
  ex_hanging_leg_raise: "hanging-leg-raise",
};

/**
 * The dedup script's override table is exactly the authoritative map — every
 * legacy id has a curated target, so matches are deterministic.
 */
export const LEGACY_OVERRIDES: Record<string, string> = LEGACY_EXERCISE_MAP;

const STOPWORDS = new Set(["the", "a", "with", "and", "of", "for"]);

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(name: string): string[] {
  return normalizeExerciseName(name)
    .split(" ")
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Similarity of a legacy exercise to a candidate, 0..1. A differing canonical
 * primary muscle is a hard veto (returns 0) — we never move history onto a
 * different muscle group. Exact normalized-name match scores 1; a candidate
 * that is a strict superset of the legacy name's tokens (e.g. "Barbell Bench
 * Press - Medium Grip" ⊇ "Barbell Bench Press") scores at least 0.85.
 */
export function scoreMatch(
  legacy: MatchExercise,
  candidate: MatchExercise,
): number {
  if (legacy.primaryMuscle !== candidate.primaryMuscle) return 0;
  if (
    normalizeExerciseName(legacy.name) === normalizeExerciseName(candidate.name)
  ) {
    return 1;
  }
  const lt = tokens(legacy.name);
  const ct = tokens(candidate.name);
  if (lt.length === 0) return 0;
  let score = jaccard(lt, ct);
  if (lt.every((t) => ct.includes(t))) score = Math.max(score, 0.85);
  return score;
}

function confidenceFor(score: number): MatchConfidence {
  if (score >= 1) return "exact";
  if (score >= 0.85) return "strong";
  if (score >= 0.5) return "weak";
  return "none";
}

/**
 * Resolve the best imported match for one legacy exercise. An override wins
 * outright. Otherwise the highest-scoring imported candidate (same primary
 * muscle) is returned with a confidence band. Self and other `rackd` rows are
 * never candidates.
 */
export function matchLegacyExercise(
  legacy: MatchExercise,
  candidates: MatchExercise[],
): LegacyMatch {
  const overrideId = LEGACY_OVERRIDES[legacy.id];
  if (overrideId) {
    const c = candidates.find((x) => x.id === overrideId);
    return {
      legacyId: legacy.id,
      targetId: overrideId,
      targetName: c?.name,
      confidence: "exact",
      score: 1,
      via: "override",
    };
  }

  let best: MatchExercise | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    if (c.id === legacy.id || c.source === "rackd") continue;
    const s = scoreMatch(legacy, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  const confidence = confidenceFor(bestScore);
  if (!best || confidence === "none") {
    return {
      legacyId: legacy.id,
      targetId: null,
      confidence: "none",
      score: bestScore,
      via: "none",
    };
  }
  return {
    legacyId: legacy.id,
    targetId: best.id,
    targetName: best.name,
    confidence,
    score: bestScore,
    via: "auto",
  };
}

/**
 * Whether a match is safe to apply destructively (repoint history + delete the
 * legacy row). Overrides and exact/strong auto-matches qualify; weak/none do
 * not — those are left in place for the operator to confirm via an override.
 */
export function isApplicable(match: LegacyMatch): boolean {
  return (
    match.targetId !== null &&
    (match.via === "override" ||
      match.confidence === "exact" ||
      match.confidence === "strong")
  );
}
