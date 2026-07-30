/**
 * Pure normalization + derivation for ingesting exercise datasets into our
 * canonical model. ZERO IO — the @rackd/db ingest scripts wrap these with fetch
 * + DB writes. Source #1 is `yuhonas/free-exercise-db` (public domain). Derived
 * fields (movementPattern, isUnilateral, activation) are computed here once and
 * stored — they exist in no source (see docs/specs/exercise-data-platform.md).
 */

import type {
  BodyRegion,
  Equipment,
  ExerciseCategory,
  Force,
  Level,
  Mechanic,
  MovementPattern,
  Muscle,
  MuscleGroup,
  MuscleInvolvement,
  MuscleRole,
} from "./types";

/** One record as shipped by free-exercise-db's `dist/exercises.json`. */
export interface FreeExerciseRecord {
  id: string;
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

/** Raw image base for free-exercise-db (paths are relative to this). */
export const FREE_EXERCISE_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

/**
 * Fine-grained muscle taxonomy. `canonicalGroup` maps each muscle to the coarse
 * 13-value MuscleGroup the app UI/stats use; `svgRegion` keys the MuscleMap SVG;
 * `recoveryHours` is the fatigue-engine baseline (bigger muscles recover slower).
 */
export const MUSCLE_TAXONOMY: Muscle[] = [
  {
    id: "chest",
    name: "Chest",
    canonicalGroup: "chest",
    region: "upper",
    svgRegion: "chest",
    recoveryHours: 48,
  },
  {
    id: "lats",
    name: "Lats",
    canonicalGroup: "back",
    region: "upper",
    svgRegion: "upper-back",
    recoveryHours: 72,
  },
  {
    id: "middle_back",
    name: "Middle back",
    canonicalGroup: "back",
    region: "upper",
    svgRegion: "upper-back",
    recoveryHours: 72,
  },
  {
    id: "lower_back",
    name: "Lower back",
    canonicalGroup: "back",
    region: "core",
    svgRegion: "lower-back",
    recoveryHours: 72,
  },
  {
    id: "traps",
    name: "Traps",
    canonicalGroup: "traps",
    region: "upper",
    svgRegion: "trapezius",
    recoveryHours: 48,
  },
  {
    id: "shoulders",
    name: "Shoulders",
    canonicalGroup: "shoulders",
    region: "upper",
    svgRegion: "front-deltoids",
    recoveryHours: 48,
  },
  {
    id: "biceps",
    name: "Biceps",
    canonicalGroup: "biceps",
    region: "upper",
    svgRegion: "biceps",
    recoveryHours: 48,
  },
  {
    id: "triceps",
    name: "Triceps",
    canonicalGroup: "triceps",
    region: "upper",
    svgRegion: "triceps",
    recoveryHours: 48,
  },
  {
    id: "forearms",
    name: "Forearms",
    canonicalGroup: "forearms",
    region: "upper",
    svgRegion: "forearm",
    recoveryHours: 24,
  },
  {
    id: "abdominals",
    name: "Abdominals",
    canonicalGroup: "abs",
    region: "core",
    svgRegion: "abs",
    recoveryHours: 24,
  },
  {
    id: "quadriceps",
    name: "Quadriceps",
    canonicalGroup: "quads",
    region: "lower",
    svgRegion: "quadriceps",
    recoveryHours: 72,
  },
  {
    id: "hamstrings",
    name: "Hamstrings",
    canonicalGroup: "hamstrings",
    region: "lower",
    svgRegion: "hamstring",
    recoveryHours: 72,
  },
  {
    id: "glutes",
    name: "Glutes",
    canonicalGroup: "glutes",
    region: "lower",
    svgRegion: "gluteal",
    recoveryHours: 72,
  },
  {
    id: "calves",
    name: "Calves",
    canonicalGroup: "calves",
    region: "lower",
    svgRegion: "calves",
    recoveryHours: 48,
  },
  {
    id: "abductors",
    name: "Abductors",
    canonicalGroup: "glutes",
    region: "lower",
    svgRegion: "gluteal",
    recoveryHours: 48,
  },
  {
    id: "adductors",
    name: "Adductors",
    canonicalGroup: "quads",
    region: "lower",
    svgRegion: "adductor",
    recoveryHours: 48,
  },
  { id: "neck", name: "Neck", canonicalGroup: "traps", region: "upper", recoveryHours: 24 },
];

const MUSCLE_BY_ID = new Map(MUSCLE_TAXONOMY.map((m) => [m.id, m]));

/** Source muscle string (free-exercise-db, lowercased) → our muscle id. */
export const SOURCE_MUSCLE_MAP: Record<string, string> = {
  abdominals: "abdominals",
  abductors: "abductors",
  adductors: "adductors",
  biceps: "biceps",
  calves: "calves",
  chest: "chest",
  forearms: "forearms",
  glutes: "glutes",
  hamstrings: "hamstrings",
  lats: "lats",
  "lower back": "lower_back",
  "middle back": "middle_back",
  neck: "neck",
  quadriceps: "quadriceps",
  shoulders: "shoulders",
  traps: "traps",
  triceps: "triceps",
};

/** Source equipment string (free-exercise-db, lowercased) → our Equipment. */
export const SOURCE_EQUIPMENT_MAP: Record<string, Equipment> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  cable: "cable",
  machine: "machine",
  "body only": "bodyweight",
  kettlebells: "kettlebell",
  bands: "band",
  "medicine ball": "other",
  "exercise ball": "other",
  "foam roll": "other",
  "e-z curl bar": "barbell",
  other: "other",
};

/** URL-safe slug: lowercase, alphanumerics → single hyphens, trimmed. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mapMuscleId(raw: string): string | undefined {
  return SOURCE_MUSCLE_MAP[raw.trim().toLowerCase()];
}

export function mapEquipment(raw: string | null | undefined): Equipment {
  if (!raw) return "bodyweight";
  return SOURCE_EQUIPMENT_MAP[raw.trim().toLowerCase()] ?? "other";
}

export function canonicalGroupOf(muscleId: string): MuscleGroup | undefined {
  return MUSCLE_BY_ID.get(muscleId)?.canonicalGroup;
}

/** Coarse exercise category, derived from canonical equipment (mirrors the seed). */
export function deriveCategory(equipment: Equipment, sourceCategory?: string): ExerciseCategory {
  if (sourceCategory?.trim().toLowerCase() === "cardio") return "cardio";
  switch (equipment) {
    case "barbell":
      return "barbell";
    case "dumbbell":
    case "kettlebell":
      return "dumbbell";
    case "machine":
    case "cable":
      return "machine";
    default:
      return "bodyweight";
  }
}

export function deriveBodyRegion(group: MuscleGroup): BodyRegion {
  if (group === "fullbody") return "full";
  if (["quads", "hamstrings", "glutes", "calves"].includes(group)) return "lower";
  if (group === "abs") return "core";
  return "upper";
}

const UNILATERAL_RE =
  /\b(single[- ]?arm|single[- ]?leg|one[- ]?arm|one[- ]?leg|alternat[a-z]*|split squat|bulgarian|pistol|step[- ]?up)\b/i;

export function deriveIsUnilateral(name: string): boolean {
  return UNILATERAL_RE.test(name);
}

/**
 * Coarse movement pattern from the exercise name (+ mechanic fallback). Heuristic
 * v1 — order matters (lunge before squat, hinge before generic). Returns
 * undefined when nothing matches and the lift isn't a clear isolation.
 */
export function deriveMovementPattern(
  name: string,
  mechanic?: Mechanic | null,
): MovementPattern | undefined {
  const n = name.toLowerCase();
  if (/face pull/.test(n)) return "pull";
  if (/lunge|split squat|bulgarian|step[- ]?up/.test(n)) return "lunge";
  if (/squat/.test(n)) return "squat";
  if (/deadlift|romanian|\brdl\b|good[- ]?morning|hip thrust|swing|hinge/.test(n)) return "hinge";
  if (/carry|farmer/.test(n)) return "carry";
  if (/plank|crunch|sit[- ]?up|leg raise|russian twist|ab wheel|hollow/.test(n)) return "core";
  if (/press|push[- ]?up|pushup|bench|\bdip\b|\bfly\b|overhead/.test(n)) return "push";
  if (/row|pull[- ]?up|pullup|pulldown|chin[- ]?up|\bcurl\b|shrug/.test(n)) return "pull";
  return mechanic === "isolation" ? "isolation" : undefined;
}

const ACTIVATION: Record<MuscleRole, number> = {
  primary: 1,
  secondary: 0.5,
  tertiary: 0.25,
};

export function activationForRole(role: MuscleRole): number {
  return ACTIVATION[role];
}

function normForce(raw: string | null): Force | undefined {
  const f = raw?.trim().toLowerCase();
  return f === "push" || f === "pull" || f === "static" ? f : undefined;
}

function normLevel(raw: string): Level | undefined {
  const l = raw?.trim().toLowerCase();
  return l === "beginner" || l === "intermediate" || l === "expert" ? l : undefined;
}

function normMechanic(raw: string | null): Mechanic | undefined {
  const m = raw?.trim().toLowerCase();
  return m === "compound" || m === "isolation" ? m : undefined;
}

/** Fully normalized exercise, ready for the @rackd/db ingest upsert. */
export interface NormalizedExercise {
  id: string;
  source: string;
  sourceId: string;
  slug: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  instructions: string;
  force?: Force;
  level?: Level;
  mechanic?: Mechanic;
  movementPattern?: MovementPattern;
  isUnilateral: boolean;
  bodyPart: BodyRegion;
  /** Fine-grained muscle involvement (with derived activation weights). */
  muscles: MuscleInvolvement[];
  /** Absolute image URLs from the source (mirrored to our CDN in a later phase). */
  images: string[];
}

/**
 * Map one free-exercise-db record to our canonical model. Unmappable muscles are
 * dropped from `muscles` and surfaced via `unmappedMuscles` so the ingest script
 * can log them (never silently lost). Primary muscle group falls back to the
 * first secondary, then "fullbody", so every row has a valid coarse group.
 */
export function normalizeFreeExercise(rec: FreeExerciseRecord): {
  exercise: NormalizedExercise;
  unmappedMuscles: string[];
} {
  const unmapped: string[] = [];
  const resolve = (raw: string, role: MuscleRole): MuscleInvolvement | null => {
    const id = mapMuscleId(raw);
    if (!id) {
      unmapped.push(raw);
      return null;
    }
    return { muscleId: id, role, activation: activationForRole(role) };
  };

  const primaryInv = rec.primaryMuscles
    .map((m) => resolve(m, "primary"))
    .filter((x): x is MuscleInvolvement => x !== null);
  const secondaryInv = rec.secondaryMuscles
    .map((m) => resolve(m, "secondary"))
    .filter((x): x is MuscleInvolvement => x !== null);

  const primaryGroups = primaryInv
    .map((i) => canonicalGroupOf(i.muscleId))
    .filter((g): g is MuscleGroup => Boolean(g));
  const secondaryGroups = secondaryInv
    .map((i) => canonicalGroupOf(i.muscleId))
    .filter((g): g is MuscleGroup => Boolean(g));

  const primaryMuscle: MuscleGroup = primaryGroups[0] ?? secondaryGroups[0] ?? "fullbody";
  // Coarse secondary groups, de-duped and minus the primary.
  const secondaryMuscles = Array.from(
    new Set([...primaryGroups.slice(1), ...secondaryGroups]),
  ).filter((g) => g !== primaryMuscle);

  const equipment = mapEquipment(rec.equipment);
  const mechanic = normMechanic(rec.mechanic);

  return {
    exercise: {
      id: slugify(rec.id),
      source: "free-exercise-db",
      sourceId: rec.id,
      slug: slugify(rec.id),
      name: rec.name,
      primaryMuscle,
      secondaryMuscles,
      equipment,
      category: deriveCategory(equipment, rec.category),
      instructions: rec.instructions.join("\n"),
      force: normForce(rec.force),
      level: normLevel(rec.level),
      mechanic,
      movementPattern: deriveMovementPattern(rec.name, mechanic),
      isUnilateral: deriveIsUnilateral(rec.name),
      bodyPart: deriveBodyRegion(primaryMuscle),
      muscles: [...primaryInv, ...secondaryInv],
      images: rec.images.map((p) => FREE_EXERCISE_IMAGE_BASE + p),
    },
    unmappedMuscles: unmapped,
  };
}
