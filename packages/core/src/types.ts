/**
 * Single source of truth for MyFit domain types (DRY).
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
  /**
   * Weekdays this routine is scheduled for — 0=Sun … 6=Sat (matches
   * `Date.getDay()`). Drives the dashboard's "today's workout". Empty/absent =
   * not scheduled. Stored as a Set in the DB.
   */
  scheduledDays?: number[];
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

/**
 * A program groups routines into a schedule. Two scheduling models, both built
 * on the ordered `ProgramDay` children:
 *  - "rotation": cycle the ordered days irrespective of the calendar. `rotationCursor`
 *    is the index of today's day; a day with no `routineId` is a rest day (skipped
 *    when advancing to the next workout).
 *  - "weekly": each day is pinned to a `weekday` (0=Sun … 6=Sat); today's day is the
 *    one whose `weekday` matches the current day.
 * `active` marks the single program that drives the dashboard's "today's workout".
 * All scheduling fields are optional so existing programs stay valid (no schedule).
 */
export interface Program {
  id: string;
  ownerId: string;
  name: string;
  notes?: string;
  order: number;
  /** The one active program — drives the dashboard "today's workout". */
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  /** Rotation mode: index into the ordered ProgramDays for "today". */
  rotationCursor?: number;
}

export interface ProgramDay {
  id: string;
  programId: string;
  order: number;
  name: string;
  routineId?: string;
  /** Weekly mode: the weekday this day is pinned to (0=Sun … 6=Sat). */
  weekday?: number;
}

export interface BodyMetric {
  id: string;
  ownerId: string;
  date: number;
  weightKg: number;
  note?: string;
}

/**
 * Timestamped body-weight entry for the progress chart. Weight canonical (kg);
 * `loggedAt` is epoch ms. Owner-scoped, many rows per user.
 */
export interface BodyWeightLog {
  id: string;
  ownerId: string;
  weightKg: number;
  loggedAt: number;
}

export type TrainingGoal =
  | "build_muscle"
  | "get_stronger"
  | "lose_fat"
  | "endurance"
  | "general_fitness";

export type UnitPreference = "metric" | "imperial";

/**
 * Profile + settings, one row per user. Weights canonical (kg), height in cm —
 * never store lb/imperial. `photoUrl` is a URL only (no binary in synced DB),
 * consistent with the media rule. Defaults at create: defaultRestSec 120,
 * defaultSets 3, defaultReps 10, unitPreference "metric".
 */
export interface UserProfile {
  id: string;
  ownerId: string;
  displayName?: string;
  /** URL only — never store binary in the synced DB. */
  photoUrl?: string;
  heightCm?: number;
  currentWeightKg?: number;
  goalWeightKg?: number;
  trainingGoal?: TrainingGoal;
  unitPreference: UnitPreference;
  defaultRestSec: number;
  defaultSets: number;
  defaultReps: number;
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
