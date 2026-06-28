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

/**
 * Bar used for a barbell exercise. Drives plate math + warmup ramp.
 * Weights are per-display-unit (see `BAR_WEIGHTS` in calc.ts) so kg/lb
 * users get the clean standard numbers (20 kg / 45 lb), not a single
 * stored kg that rounds badly in the other unit.
 */
export type BarType = "standard" | "womens" | "ezbar" | "trap" | "safety";

export type ExerciseCategory =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "bodyweight"
  | "cardio";

export type SetType = "warmup" | "normal" | "drop" | "failure";

export type MediaSource = "library" | "user";

/** Direction of resistance — powers push/pull balance in plan generation. */
export type Force = "push" | "pull" | "static";
/** Difficulty tier — search facet + plan filtering. */
export type Level = "beginner" | "intermediate" | "expert";
/** Multi- vs single-joint — shown as the Compound/Isolation badge. */
export type Mechanic = "compound" | "isolation";
/**
 * Movement pattern — DERIVED (no source ships it). Drives plan templates,
 * substitution, and balance checks.
 */
export type MovementPattern =
  | "squat"
  | "hinge"
  | "lunge"
  | "push"
  | "pull"
  | "carry"
  | "core"
  | "isolation";
/** Coarse body region for search facets + upper/lower balance. */
export type BodyRegion = "upper" | "lower" | "core" | "full";

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  instructions: string;
  /** Short coaching cues shown as a checklist on the exercise detail. */
  formCues?: string[];
  /** Poster frame — loads first, tiny. */
  thumbnailUrl?: string;
  /** 3-5s muted MP4 loop — lazy-loaded, cached-on-view. URL only, never in sync DB blob. */
  clipUrl?: string;
  /** Optional smaller WebM alternative. */
  clipUrlWebm?: string;
  mediaSource: MediaSource;
  isCustom: boolean;
  ownerId?: string;

  // --- Exercise data platform (all optional so existing rows/code stay valid) ---
  /** Dataset this row came from: 'free-exercise-db' | 'wger' | 'exercisedb' | 'rackd'. */
  source?: string;
  /** Original id from the source dataset (upsert key with `source`). */
  sourceId?: string;
  /** URL-safe identifier. */
  slug?: string;
  force?: Force;
  level?: Level;
  mechanic?: Mechanic;
  /** DERIVED at ingest. */
  movementPattern?: MovementPattern;
  /** DERIVED at ingest — single-limb movement (affects per-side fatigue/balance). */
  isUnilateral?: boolean;
  bodyPart?: BodyRegion;
  /** Search synonyms / alternate names. */
  aliases?: string[];
  /** Ranking weight for search. */
  popularity?: number;
}

/** Which muscle an exercise hits and how hard. */
export type MuscleRole = "primary" | "secondary" | "tertiary";

/**
 * Fine-grained muscle in the taxonomy. `canonicalGroup` maps it back to the
 * coarse 13-value MuscleGroup the app UI/logic uses; `svgRegion` is the path id
 * in the self-owned MuscleMap SVG. `recoveryHours` feeds the fatigue engine.
 */
export interface Muscle {
  id: string;
  name: string;
  canonicalGroup: MuscleGroup;
  region?: BodyRegion;
  svgRegion?: string;
  recoveryHours: number;
}

/** A muscle an exercise works, with a DERIVED activation weight (0..1). */
export interface MuscleInvolvement {
  muscleId: string;
  role: MuscleRole;
  activation: number;
}

export type ExerciseMediaKind =
  | "image"
  | "thumbnail"
  | "gif"
  | "video"
  | "muscle_map";

/** Media row — URL only (mirrored to our CDN), never binary in the DB. */
export interface ExerciseMedia {
  id: string;
  exerciseId: string;
  kind: ExerciseMediaKind;
  /** Our CDN URL. */
  url: string;
  /** Source URL kept for provenance. */
  originalUrl?: string;
  width?: number;
  height?: number;
  order: number;
  lang?: string;
}

export type ExerciseRelationKind = "variation" | "similar" | "substitute";

/** Edge in the similarity / substitution graph. */
export interface ExerciseRelation {
  exerciseId: string;
  relatedId: string;
  kind: ExerciseRelationKind;
  score: number;
  reason?: string;
}

/**
 * A bundled, public plan template (PPL, 5/3/1, …) — the read-only library users
 * clone into their own `routines`. Distinct from the user-scoped `Program`.
 */
export interface ProgramTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string;
  goal?: TrainingGoal;
  level?: Level;
  /** Methodology label, e.g. "PPL", "5/3/1", "Starting Strength". */
  methodology?: string;
  daysPerWeek?: number;
  durationWeeks?: number;
  equipmentNeeded: Equipment[];
  source?: string;
  /** Attribution string for CC-BY-SA sources (e.g. wger). */
  attribution?: string;
  isPublic: boolean;
}

export interface ProgramTemplateDay {
  id: string;
  programTemplateId: string;
  /** Null for templates that don't vary day content by week. */
  weekIndex?: number;
  dayIndex: number;
  label: string;
}

export interface ProgramTemplateExercise {
  id: string;
  dayId: string;
  /** Resolved to our exercise; null when only `sourceName` is known. */
  exerciseId?: string;
  order: number;
  sets?: number;
  /** e.g. "8-12" or "5,5,5,5,1". */
  repScheme?: string;
  restSeconds?: number;
  /** e.g. "RPE 8" or "75% 1RM". */
  intensity?: string;
  notes?: string;
  /** Raw source name kept when unresolved to an exercise id. */
  sourceName?: string;
}

/**
 * Per-user, per-muscle fatigue. `accumulatedLoad` decays on read (wall-clock,
 * like the rest timer — never tick-counted); `lastTrainedAt` is epoch ms.
 */
export interface MuscleFatigue {
  ownerId: string;
  muscleId: string;
  accumulatedLoad: number;
  lastTrainedAt?: number;
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
   * Free-text focus/split tag (e.g. "Push", "Pull", "Legs", "Upper", "Lower").
   * Optional — absent means no explicit tag; the Plans page falls back to a
   * label derived from the routine/day name.
   */
  category?: string;
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
  /** Bar used for plate math; only meaningful for barbell exercises. */
  barType?: BarType;
}

export interface WorkoutSession {
  id: string;
  ownerId: string;
  routineId?: string;
  /** Program this workout was started under; stamped at start, never rewritten. */
  programId?: string;
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
  /** Bar used for plate math; copied from the routine at session start. */
  barType?: BarType;
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
  /**
   * Length of one training block in weeks (e.g. a 4-week mesocycle). Optional —
   * absent/0 means unset and the Plans page omits the "N-week block" tag.
   */
  blockWeeks?: number;
  /** The one active program — drives the dashboard "today's workout". */
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  /** Rotation mode: index into the ordered ProgramDays for "today". */
  rotationCursor?: number;
  /**
   * Epoch ms when the program last became active. Anchors "week 1, day 1" of
   * the block-progress bar; reset each time the program is re-activated.
   */
  activatedAt?: number;
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

/**
 * A device's Web Push subscription — the addressable handle the push sender uses
 * to reach one installed PWA (one row per device/browser). `endpoint` + `p256dh`
 * + `auth` are exactly what the `web-push` library needs; never store anything
 * secret beyond these. Owner-scoped, many rows per user (phone, laptop, …).
 */
export interface PushSubscriptionRecord {
  id: string;
  ownerId: string;
  /** Push service URL unique to this subscription (also our dedupe key). */
  endpoint: string;
  /** Client public key (base64url) for payload encryption. */
  p256dh: string;
  /** Client auth secret (base64url) for payload encryption. */
  auth: string;
  userAgent?: string;
  createdAt: number;
}

export type ScheduledPushStatus = "pending" | "sent" | "cancelled";

/**
 * A request to deliver one Web Push at `fireAt` to `subscriptionId`. The client
 * writes this when a rest timer starts (the only transport between the PWA and
 * the server-side sender); the sender polls for `pending` rows whose `fireAt`
 * has passed, delivers them, and flips `status` to `sent`. Skipping rest cancels
 * the row; adding time reschedules `fireAt`. Background delivery is the whole
 * point — a backgrounded PWA's JS is suspended and cannot notify itself.
 */
export interface ScheduledPush {
  id: string;
  ownerId: string;
  subscriptionId: string;
  /** Absolute time to deliver (epoch ms) — mirrors the timer's `endAt`. */
  fireAt: number;
  title: string;
  body: string;
  status: ScheduledPushStatus;
  createdAt: number;
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
