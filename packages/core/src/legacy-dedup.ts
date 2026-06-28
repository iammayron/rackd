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
 * Hand-reviewed legacy `ex_*` id → imported exercise id (slug). Populated after
 * eyeballing a `--dry-run` report; an entry here is treated as ground truth and
 * overrides auto-matching. Use this for legacy rows that auto-match weakly or
 * land on the wrong variant. Leave a legacy id out entirely to keep it as-is.
 */
export const LEGACY_OVERRIDES: Record<string, string> = {
  // Referenced legacy rows the auto-matcher under-scored (plural/word-order) or
  // sent to the wrong variant. Targets verified against free-exercise-db.
  ex_squat: "barbell-squat", // "Barbell Back Squat" → "Barbell Squat"
  ex_seated_row: "seated-cable-rows", // plural
  ex_single_arm_db_row: "one-arm-dumbbell-row",
  ex_straight_arm_pulldown: "straight-arm-pulldown",
  ex_leg_curl: "lying-leg-curls", // was wrongly matched to the SEATED leg curl
  ex_cable_chest_fly: "cable-crossover", // was wrongly matched to a cable PRESS
  ex_reverse_pec_deck: "reverse-machine-flyes", // no auto-match (machine rear-delt fly)
  ex_db_skullcrusher: "lying-dumbbell-tricep-extension", // no auto-match
  ex_sumo_deadlift: "sumo-deadlift", // no auto-match (primary-muscle veto)
};

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
