import {
  pgTable,
  text,
  integer,
  doublePrecision,
  boolean,
  bigint,
  primaryKey,
} from "drizzle-orm/pg-core";

/**
 * Drizzle/Postgres schema — the persisted source of truth (replaces Triplit).
 * Domain TYPES live in @rackd/core; this maps them to storage.
 *
 * Conventions:
 * - `id` is a TEXT primary key, app-generated (uuidv7) — never DB-generated.
 * - `ownerId` (= Supabase `auth.users.id`) scopes every owner-owned row; API
 *   routes add `WHERE owner_id = …`. The exercise + sharedRoutines libraries are
 *   the public exceptions (world-readable, owner-writable).
 * - Epoch-millisecond timestamps are BIGINT (they overflow int4); weights/loads
 *   are DOUBLE PRECISION (2.5 kg increments); counts/orders are INTEGER.
 * - Parent→child deletes CASCADE at the DB level so API routes don't re-walk
 *   the tree by hand. `routineId` back-references SET NULL (history/plan-day
 *   slots survive their routine being deleted).
 * - JS property names stay camelCase (DB columns snake_case) so row shapes match
 *   the @rackd/core domain types the UI already consumes.
 */

export const exercises = pgTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  primaryMuscle: text("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles").array().notNull().default([]),
  equipment: text("equipment").notNull(),
  category: text("category").notNull(),
  instructions: text("instructions").notNull().default(""),
  /** Short coaching cues shown as a checklist on the exercise detail. */
  formCues: text("form_cues").array().notNull().default([]),
  thumbnailUrl: text("thumbnail_url"),
  clipUrl: text("clip_url"),
  clipUrlWebm: text("clip_url_webm"),
  mediaSource: text("media_source").notNull().default("library"),
  isCustom: boolean("is_custom").notNull().default(false),
  ownerId: text("owner_id"),
  // --- Exercise data platform (see docs/specs/exercise-data-platform.md) ---
  // Dataset provenance; (source, sourceId) is the ingest upsert key.
  source: text("source").notNull().default("rackd"),
  sourceId: text("source_id"),
  slug: text("slug").unique(),
  force: text("force"),
  level: text("level"),
  mechanic: text("mechanic"),
  // DERIVED at ingest.
  movementPattern: text("movement_pattern"),
  isUnilateral: boolean("is_unilateral").notNull().default(false),
  bodyPart: text("body_part"),
  aliases: text("aliases").array().notNull().default([]),
  popularity: integer("popularity").notNull().default(0),
});

/**
 * Fine-grained muscle taxonomy. `canonicalGroup` maps each muscle back to the
 * coarse MuscleGroup the app UI/stats use; `svgRegion` keys the self-owned
 * MuscleMap SVG path; `recoveryHours` is the fatigue-engine baseline.
 */
export const muscles = pgTable("muscles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  canonicalGroup: text("canonical_group").notNull(),
  region: text("region"),
  svgRegion: text("svg_region"),
  recoveryHours: integer("recovery_hours").notNull().default(48),
});

/** Exercise ↔ muscle join with DERIVED activation weight (0..1). */
export const exerciseMuscles = pgTable(
  "exercise_muscles",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscleId: text("muscle_id")
      .notNull()
      .references(() => muscles.id),
    role: text("role").notNull(),
    activation: doublePrecision("activation").notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.exerciseId, t.muscleId] }) }),
);

/** Media rows — our CDN URL + source provenance. Never binary in the DB. */
export const exerciseMedia = pgTable("exercise_media", {
  id: text("id").primaryKey(),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  url: text("url").notNull(),
  originalUrl: text("original_url"),
  width: integer("width"),
  height: integer("height"),
  order: integer("order").notNull().default(0),
  lang: text("lang"),
});

/** Similarity / substitution graph edges. */
export const exerciseRelations = pgTable(
  "exercise_relations",
  {
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    relatedId: text("related_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    score: doublePrecision("score").notNull(),
    reason: text("reason"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.exerciseId, t.relatedId, t.kind] }) }),
);

/** Source equipment string → canonical Equipment enum value. */
export const equipmentMap = pgTable("equipment_map", {
  sourceValue: text("source_value").primaryKey(),
  canonical: text("canonical").notNull(),
});

/** Source muscle string → our muscle id (taxonomy reconciliation). */
export const muscleMap = pgTable("muscle_map", {
  sourceValue: text("source_value").primaryKey(),
  muscleId: text("muscle_id")
    .notNull()
    .references(() => muscles.id),
});

/**
 * Bundled, public plan template (PPL, 5/3/1, …) — the read-only library users
 * clone into their own `routines`. Distinct from the user-scoped `programs`.
 */
export const programTemplates = pgTable("program_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  goal: text("goal"),
  level: text("level"),
  methodology: text("methodology"),
  daysPerWeek: integer("days_per_week"),
  durationWeeks: integer("duration_weeks"),
  equipmentNeeded: text("equipment_needed").array().notNull().default([]),
  source: text("source"),
  attribution: text("attribution"),
  isPublic: boolean("is_public").notNull().default(true),
});

export const programTemplateDays = pgTable("program_template_days", {
  id: text("id").primaryKey(),
  programTemplateId: text("program_template_id")
    .notNull()
    .references(() => programTemplates.id, { onDelete: "cascade" }),
  weekIndex: integer("week_index"),
  dayIndex: integer("day_index").notNull(),
  label: text("label").notNull(),
});

export const programTemplateExercises = pgTable("program_template_exercises", {
  id: text("id").primaryKey(),
  dayId: text("day_id")
    .notNull()
    .references(() => programTemplateDays.id, { onDelete: "cascade" }),
  // Null while only `sourceName` is known (unresolved import).
  exerciseId: text("exercise_id").references(() => exercises.id),
  order: integer("order").notNull(),
  sets: integer("sets"),
  repScheme: text("rep_scheme"),
  restSeconds: integer("rest_seconds"),
  intensity: text("intensity"),
  notes: text("notes"),
  sourceName: text("source_name"),
});

/**
 * Per-user, per-muscle fatigue. `accumulatedLoad` decays on read (wall-clock,
 * like the rest timer); `lastTrainedAt` is epoch ms. Owner-scoped.
 */
export const muscleFatigue = pgTable(
  "muscle_fatigue",
  {
    ownerId: text("owner_id").notNull(),
    muscleId: text("muscle_id")
      .notNull()
      .references(() => muscles.id),
    accumulatedLoad: doublePrecision("accumulated_load").notNull().default(0),
    lastTrainedAt: bigint("last_trained_at", { mode: "number" }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.ownerId, t.muscleId] }) }),
);

export const routines = pgTable("routines", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  folderId: text("folder_id"),
  notes: text("notes"),
  order: integer("order").notNull().default(0),
  category: text("category"),
  // Weekdays (0=Sun … 6=Sat) this routine is scheduled for; null = unscheduled.
  scheduledDays: integer("scheduled_days").array(),
});

export const routineExercises = pgTable("routine_exercises", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  order: integer("order").notNull(),
  supersetGroup: integer("superset_group"),
  restSec: integer("rest_sec").notNull().default(120),
  notes: text("notes"),
  // Bar used for plate math (BarType in @rackd/core); only meaningful for
  // barbell exercises. Default "standard" so existing rows behave as today.
  barType: text("bar_type").notNull().default("standard"),
});

export const routineSets = pgTable("routine_sets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  routineExerciseId: text("routine_exercise_id")
    .notNull()
    .references(() => routineExercises.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  type: text("type").notNull().default("normal"),
  targetReps: integer("target_reps"),
  targetWeight: doublePrecision("target_weight"),
  targetRpe: doublePrecision("target_rpe"),
  tempo: text("tempo"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  // Source routine (if any). SET NULL on routine delete — the session is history
  // and must outlive its plan.
  routineId: text("routine_id").references(() => routines.id, {
    onDelete: "set null",
  }),
  // Program this workout was started under (if any). Stamped at start time and
  // never rewritten, so day/week progress survives a routine being forked or
  // re-pointed by save-back. SET NULL on program delete — history outlives the
  // plan. Progress counting joins on this, not routineId (which can churn).
  programId: text("program_id").references(() => programs.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }),
  notes: text("notes"),
  bodyweight: doublePrecision("bodyweight"),
});

export const sessionExercises = pgTable("session_exercises", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  order: integer("order").notNull(),
  supersetGroup: integer("superset_group"),
  restSec: integer("rest_sec").notNull().default(120),
  // Copied from the routine exercise at session start (see startSessionFromRoutine).
  barType: text("bar_type").notNull().default("standard"),
});

export const setLogs = pgTable("set_logs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  sessionExerciseId: text("session_exercise_id")
    .notNull()
    .references(() => sessionExercises.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  type: text("type").notNull().default("normal"),
  weight: doublePrecision("weight").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  rpe: doublePrecision("rpe"),
  completed: boolean("completed").notNull().default(false),
  restTakenSec: integer("rest_taken_sec"),
  isPr: boolean("is_pr").notNull().default(false),
});

export const personalRecords = pgTable("personal_records", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  type: text("type").notNull(),
  value: doublePrecision("value").notNull(),
  sessionId: text("session_id").notNull(),
  achievedAt: bigint("achieved_at", { mode: "number" }).notNull(),
});

export const bodyMetrics = pgTable("body_metrics", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  date: bigint("date", { mode: "number" }).notNull(),
  weightKg: doublePrecision("weight_kg").notNull(),
  note: text("note"),
});

export const bodyWeightLogs = pgTable("body_weight_logs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  weightKg: doublePrecision("weight_kg").notNull(),
  loggedAt: bigint("logged_at", { mode: "number" }).notNull(),
});

export const programs = pgTable("programs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  notes: text("notes"),
  order: integer("order").notNull().default(0),
  blockWeeks: integer("block_weeks"),
  active: boolean("active"),
  scheduleMode: text("schedule_mode"),
  rotationCursor: integer("rotation_cursor"),
  // When the program last became active — anchors "week 1, day 1" for the
  // dashboard's week-block progress bar. Reset each time it's re-activated.
  activatedAt: bigint("activated_at", { mode: "number" }),
  // Last explicit nudge of the rotation ("Skip"). A rotation restarts itself at
  // day 1 after LAYOFF_RESTART_DAYS away, measured from the later of this and
  // the last finished workout — so skipping during a layoff sticks instead of
  // being re-restarted on the next render.
  rotationTouchedAt: bigint("rotation_touched_at", { mode: "number" }),
});

export const programDays = pgTable("program_days", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default(""),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  name: text("name").notNull().default("Day"),
  // SET NULL on routine delete → the day becomes a Rest slot, structure intact.
  routineId: text("routine_id").references(() => routines.id, {
    onDelete: "set null",
  }),
  weekday: integer("weekday"),
});

export const sharedRoutines = pgTable("shared_routines", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  authorName: text("author_name").notNull().default("Someone"),
  name: text("name").notNull(),
  // Self-contained snapshot, stored as a JSON string (app stringifies/parses) so
  // the row shape stays a string — not Postgres jsonb.
  exercisesJson: text("exercises_json").notNull(),
  exerciseCount: integer("exercise_count").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const userProfile = pgTable("user_profiles", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  heightCm: doublePrecision("height_cm"),
  currentWeightKg: doublePrecision("current_weight_kg"),
  goalWeightKg: doublePrecision("goal_weight_kg"),
  trainingGoal: text("training_goal"),
  unitPreference: text("unit_preference").notNull().default("metric"),
  defaultRestSec: integer("default_rest_sec").notNull().default(120),
  defaultSets: integer("default_sets").notNull().default(3),
  defaultReps: integer("default_reps").notNull().default(10),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const scheduledPushes = pgTable("scheduled_pushes", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
  fireAt: bigint("fire_at", { mode: "number" }).notNull(),
  title: text("title").notNull().default("Rest over"),
  body: text("body").notNull().default("Time for your next set."),
  status: text("status").notNull().default("pending"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

/** All tables, for `drizzle(pool, { schema })` relational queries. */
export const schema = {
  exercises,
  muscles,
  exerciseMuscles,
  exerciseMedia,
  exerciseRelations,
  equipmentMap,
  muscleMap,
  routines,
  routineExercises,
  routineSets,
  sessions,
  sessionExercises,
  setLogs,
  personalRecords,
  bodyMetrics,
  bodyWeightLogs,
  programs,
  programDays,
  programTemplates,
  programTemplateDays,
  programTemplateExercises,
  muscleFatigue,
  sharedRoutines,
  userProfile,
  pushSubscriptions,
  scheduledPushes,
};
