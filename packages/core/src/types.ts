/**
 * Single source of truth for FitNow domain types (DRY).
 * Every app/package imports these — never redeclare a domain shape elsewhere.
 */

export type Unit = "kg" | "lb";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "abs"
  | "traps"
  | "fullbody";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "band"
  | "other";

export type ExerciseCategory =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "bodyweight"
  | "cardio";

export type SetType = "warmup" | "normal" | "drop" | "failure";

export type MediaSource = "library" | "user";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  instructions: string;
  /** Poster frame — loads first, tiny. */
  thumbnailUrl?: string;
  /** 3-5s muted MP4 loop — lazy-loaded, cached-on-view. URL only, never in sync DB blob. */
  clipUrl?: string;
  /** Optional smaller WebM alternative. */
  clipUrlWebm?: string;
  mediaSource: MediaSource;
  isCustom: boolean;
  ownerId?: string;
}

/**
 * Shared set shape. Prescription (RoutineSet) and actual (SetLog) both build on it (DRY).
 */
export interface SetShape {
  order: number;
  type: SetType;
}

export interface RoutineSet extends SetShape {
  id: string;
  routineExerciseId: string;
  targetReps?: number;
  targetWeight?: number;
  targetRpe?: number;
  tempo?: string;
}

export interface Routine {
  id: string;
  ownerId: string;
  name: string;
  folderId?: string;
  notes?: string;
  order: number;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  order: number;
  /** Same value across grouped exercises = superset/circuit. */
  supersetGroup?: number;
  restSec: number;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  ownerId: string;
  routineId?: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  notes?: string;
  bodyweight?: number;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  supersetGroup?: number;
  restSec: number;
}

export interface SetLog extends SetShape {
  id: string;
  sessionExerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  restTakenSec?: number;
  isPr: boolean;
}

export type PrType = "1rm" | "weight" | "reps" | "volume";

export interface PersonalRecord {
  id: string;
  ownerId: string;
  exerciseId: string;
  type: PrType;
  value: number;
  sessionId: string;
  achievedAt: number;
}
