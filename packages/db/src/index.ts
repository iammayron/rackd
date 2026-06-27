import { eq, and, gte, lte, asc, desc, notExists, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { estimate1RM } from "@rackd/core";
import type {
  TrainingGoal,
  UnitPreference,
  DiffExercise,
  ScheduledPush,
  PushSubscriptionRecord,
} from "@rackd/core";
import { db } from "./db";
import * as t from "./schema";

export { db } from "./db";
export type { DB } from "./db";
export * as schema from "./schema";
// S3 helpers are exposed via the "@rackd/db/s3" subpath (not here) so packages
// without the DOM lib (e.g. @rackd/push) don't compile the fetch/BodyInit code.
export { SEED_EXERCISES } from "./seed";
export type { SeedExercise } from "./seed";
export { seedExercises } from "./seed-pg";
export { PROGRAM_TEMPLATES, cloneProgramTemplate } from "./templates";
export type { ProgramTemplate } from "./templates";

/**
 * Repository layer — one command function per intent. API route handlers call
 * these (never the Drizzle `db` directly from a route's body), keeping mutations
 * in one place. Functions are id-based; the route enforces ownership (it derives
 * `ownerId` from the JWT and scopes its own reads / passes it into creates).
 *
 * Row ids are app-generated (uuidv7) — never DB-generated — so a child can be
 * created referencing a parent in the same request without a round-trip.
 */
const newId = (): string => uuidv7();

/* The repo plumbing below is intentionally loosely typed: a single generic
 * insert/owner-lookup helper across 16 tables can't be expressed through
 * Drizzle's per-table insert/select generics without per-call casts, so the two
 * helpers take `any` tables. Public functions keep precise argument types; route
 * handlers type their JSON responses at the edge. */
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Derive ownerId from a parent row so child rows stay owner-scoped (DRY). */
async function ownerOf(table: any, id: string): Promise<string> {
  const [row] = await db
    .select({ ownerId: table.ownerId })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  return (row?.ownerId as string) ?? "";
}

/** Insert one row (id auto-filled) and return it. */
async function insertRow(
  table: any,
  values: Record<string, unknown>,
): Promise<any> {
  const rows = await db
    .insert(table)
    .values({ id: newId(), ...values })
    .returning();
  return (rows as any[])[0];
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ---------------------------------------------------------------------------
 * Sessions (live workout tree)
 * ------------------------------------------------------------------------- */

/**
 * One exercise plus its fine-grained muscle involvement (joined to the muscle
 * taxonomy for display name + canonical group) and ordered media. Muscles are
 * sorted primary → secondary → tertiary, then by activation. Read-only; the
 * route does the owner/visibility check on the base row.
 */
export async function getExerciseDetail(id: string) {
  const [exercise] = await db
    .select()
    .from(t.exercises)
    .where(eq(t.exercises.id, id))
    .limit(1);
  if (!exercise) return null;

  const muscles = await db
    .select({
      muscleId: t.exerciseMuscles.muscleId,
      role: t.exerciseMuscles.role,
      activation: t.exerciseMuscles.activation,
      name: t.muscles.name,
      canonicalGroup: t.muscles.canonicalGroup,
    })
    .from(t.exerciseMuscles)
    .innerJoin(t.muscles, eq(t.muscles.id, t.exerciseMuscles.muscleId))
    .where(eq(t.exerciseMuscles.exerciseId, id));

  const roleRank: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 };
  muscles.sort(
    (a, b) =>
      (roleRank[a.role] ?? 9) - (roleRank[b.role] ?? 9) || b.activation - a.activation,
  );

  const media = await db
    .select({
      kind: t.exerciseMedia.kind,
      url: t.exerciseMedia.url,
      width: t.exerciseMedia.width,
      height: t.exerciseMedia.height,
      order: t.exerciseMedia.order,
    })
    .from(t.exerciseMedia)
    .where(eq(t.exerciseMedia.exerciseId, id))
    .orderBy(asc(t.exerciseMedia.order));

  return { ...exercise, muscles, media };
}

export async function startSession(args: {
  ownerId: string;
  routineId?: string;
  programId?: string;
  name: string;
  now: number;
}) {
  return insertRow(t.sessions, {
    ownerId: args.ownerId,
    routineId: args.routineId,
    programId: args.programId,
    name: args.name,
    startedAt: args.now,
  });
}

/** Add an exercise to a live session (a session "card"). */
export async function addSessionExercise(args: {
  sessionId: string;
  exerciseId: string;
  order: number;
  restSec?: number;
}) {
  const ownerId = await ownerOf(t.sessions, args.sessionId);
  // An exercise added mid-workout inherits the lifter's default rest, not a
  // hardcoded 2:00 — match what a fresh routine exercise gets.
  const restSec =
    args.restSec ?? (await getProfile(ownerId)).defaultRestSec ?? 120;
  return insertRow(t.sessionExercises, {
    ownerId,
    sessionId: args.sessionId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec,
  });
}

export async function setSessionExerciseOrder(id: string, order: number) {
  await db
    .update(t.sessionExercises)
    .set({ order })
    .where(eq(t.sessionExercises.id, id));
}

/** Patch mutable fields of a live session exercise (currently its rest time). */
export async function updateSessionExercise(
  id: string,
  patch: { restSec?: number },
) {
  if (patch.restSec === undefined) return;
  await db
    .update(t.sessionExercises)
    .set({ restSec: patch.restSec })
    .where(eq(t.sessionExercises.id, id));
}

export async function setRoutineExerciseOrder(id: string, order: number) {
  await db
    .update(t.routineExercises)
    .set({ order })
    .where(eq(t.routineExercises.id, id));
}

/** Patch mutable fields of a routine exercise (currently its rest time). */
export async function updateRoutineExercise(
  id: string,
  patch: { restSec?: number },
) {
  if (patch.restSec === undefined) return;
  await db
    .update(t.routineExercises)
    .set({ restSec: patch.restSec })
    .where(eq(t.routineExercises.id, id));
}

/**
 * Persist a full reorder of a session's exercises: `order` becomes the 1-based
 * position in `orderedIds`. Only touches `sessionExercises` (session is a deep
 * copy of the plan — the routine is untouched).
 */
export async function reorderSessionExercises(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(t.sessionExercises)
        .set({ order: i + 1 })
        .where(eq(t.sessionExercises.id, id)),
    ),
  );
}

/** Persist a full reorder: `order` becomes the 1-based position in `orderedIds`. */
export async function reorderRoutineExercises(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(t.routineExercises)
        .set({ order: i + 1 })
        .where(eq(t.routineExercises.id, id)),
    ),
  );
}

export async function setRoutineExerciseSuperset(
  id: string,
  group: number | undefined,
) {
  await db
    .update(t.routineExercises)
    .set({ supersetGroup: group ?? null })
    .where(eq(t.routineExercises.id, id));
}

/**
 * Swap which library exercise a routine slot points at, keeping its order,
 * superset link, rest and prescribed sets.
 */
export async function replaceRoutineExercise(
  id: string,
  newExerciseId: string,
) {
  await db
    .update(t.routineExercises)
    .set({ exerciseId: newExerciseId })
    .where(eq(t.routineExercises.id, id));
}

/** Swap which library exercise a live session slot points at, keeping order/rest. */
export async function replaceSessionExercise(
  id: string,
  newExerciseId: string,
) {
  await db
    .update(t.sessionExercises)
    .set({ exerciseId: newExerciseId })
    .where(eq(t.sessionExercises.id, id));
}

/** Remove an exercise from a live session, including its logged sets (FK cascade). */
export async function removeSessionExercise(sessionExerciseId: string) {
  await db
    .delete(t.sessionExercises)
    .where(eq(t.sessionExercises.id, sessionExerciseId));
}

/** Add an empty (uncompleted) set row to a session exercise. */
export async function addSet(args: {
  sessionExerciseId: string;
  order: number;
  type?: string;
  weight?: number;
  reps?: number;
}) {
  return insertRow(t.setLogs, {
    ownerId: await ownerOf(t.sessionExercises, args.sessionExerciseId),
    sessionExerciseId: args.sessionExerciseId,
    order: args.order,
    type: args.type ?? "normal",
    weight: args.weight ?? 0,
    reps: args.reps ?? 0,
    completed: false,
  });
}

export async function updateSet(
  id: string,
  patch: { weight?: number; reps?: number; rpe?: number; completed?: boolean },
) {
  const set: Record<string, unknown> = {};
  if (patch.weight !== undefined) set.weight = patch.weight;
  if (patch.reps !== undefined) set.reps = patch.reps;
  // `"rpe" in patch` (not `!== undefined`) so callers can CLEAR rpe by passing
  // `rpe: undefined`. Absent key = leave untouched; present-but-undefined = reset.
  if ("rpe" in patch) set.rpe = patch.rpe ?? null;
  if (patch.completed !== undefined) set.completed = patch.completed;
  if (Object.keys(set).length === 0) return;
  await db.update(t.setLogs).set(set).where(eq(t.setLogs.id, id));
}

export async function deleteSet(id: string) {
  await db.delete(t.setLogs).where(eq(t.setLogs.id, id));
}

export async function logSet(args: {
  sessionExerciseId: string;
  order: number;
  weight: number;
  reps: number;
  rpe?: number;
  type?: string;
}) {
  return insertRow(t.setLogs, {
    ownerId: await ownerOf(t.sessionExercises, args.sessionExerciseId),
    sessionExerciseId: args.sessionExerciseId,
    order: args.order,
    weight: args.weight,
    reps: args.reps,
    rpe: args.rpe,
    type: args.type ?? "normal",
    completed: true,
  });
}

export async function finishSession(sessionId: string, now: number) {
  await db
    .update(t.sessions)
    .set({ endedAt: now })
    .where(eq(t.sessions.id, sessionId));
  const [session] = await db
    .select()
    .from(t.sessions)
    .where(eq(t.sessions.id, sessionId))
    .limit(1);
  if (session) {
    // Carry an in-workout rest edit back to the routine for the next run.
    await syncRestToRoutine(sessionId);
    // Move the program forward so the next day becomes "today".
    await advanceProgramRotation(session);
    return detectAndRecordPRs({ sessionId, ownerId: session.ownerId, now });
  }
  return [];
}

/**
 * Advance an active rotation program's cursor when one of its days is completed,
 * so finishing a scheduled workout makes the next day "today". Without this the
 * cursor only ever moved on an explicit Skip, leaving the program parked on the
 * same day after every workout. The cursor is set to the day *after* the one
 * just finished (matching `programTodaySlot`'s order-sorted indexing), which also
 * handles finishing a day out of order (e.g. via the Home "Train next" button).
 *
 * No-op for quick (routine-less) sessions, weekly-mode programs, and sessions
 * whose routine isn't part of the active program.
 */
async function advanceProgramRotation(session: {
  ownerId: string;
  routineId: string | null;
}) {
  if (!session.routineId) return;
  const actives = await db
    .select()
    .from(t.programs)
    .where(
      and(eq(t.programs.ownerId, session.ownerId), eq(t.programs.active, true)),
    );
  for (const pr of actives) {
    if ((pr.scheduleMode ?? "rotation") !== "rotation") continue;
    const days = await db
      .select()
      .from(t.programDays)
      .where(eq(t.programDays.programId, pr.id))
      .orderBy(asc(t.programDays.order));
    if (days.length === 0) continue;
    const idx = days.findIndex((d) => d.routineId === session.routineId);
    if (idx === -1) continue;
    const next = (idx + 1) % days.length;
    if (next !== (pr.rotationCursor ?? 0)) {
      await db
        .update(t.programs)
        .set({ rotationCursor: next })
        .where(eq(t.programs.id, pr.id));
    }
    break;
  }
}

/**
 * Carry per-exercise rest edits made during a live workout back to the source
 * routine so the next run starts from the same rest timers. ONLY `restSec` is
 * synced; performed sets/loads are never pushed (that's the explicit save-back).
 * Pairs session exercises to routine slots by exerciseId, using order for dupes.
 */
async function syncRestToRoutine(sessionId: string) {
  const [session] = await db
    .select()
    .from(t.sessions)
    .where(eq(t.sessions.id, sessionId))
    .limit(1);
  if (!session?.routineId) return;

  const routineExs = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, session.routineId));
  if (routineExs.length === 0) return;

  const sessionExs = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, sessionId));
  if (sessionExs.length === 0) return;

  const slotsByExId = new Map<string, typeof routineExs>();
  for (const re of routineExs) {
    const list = slotsByExId.get(re.exerciseId) ?? [];
    list.push(re);
    slotsByExId.set(re.exerciseId, list);
  }
  for (const list of slotsByExId.values())
    list.sort((a, b) => a.order - b.order);

  const claimed = new Set<string>();
  const orderedSes = [...sessionExs].sort((a, b) => a.order - b.order);
  for (const se of orderedSes) {
    const slot = slotsByExId
      .get(se.exerciseId)
      ?.find((re) => !claimed.has(re.id));
    if (!slot) continue;
    claimed.add(slot.id);
    if (slot.restSec !== se.restSec) {
      await db
        .update(t.routineExercises)
        .set({ restSec: se.restSec })
        .where(eq(t.routineExercises.id, slot.id));
    }
  }
}

export interface DetectedPR {
  exerciseId: string;
  type: "1rm" | "weight";
  value: number;
}

/**
 * After a session, record new all-time PRs (est 1RM + max weight) per exercise.
 * personalRecords is the running ledger; the contributing set is flagged isPr.
 */
export async function detectAndRecordPRs(args: {
  sessionId: string;
  ownerId: string;
  now: number;
}): Promise<DetectedPR[]> {
  const found: DetectedPR[] = [];
  const ses = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, args.sessionId));

  for (const se of ses) {
    const sets = await db
      .select()
      .from(t.setLogs)
      .where(
        and(
          eq(t.setLogs.sessionExerciseId, se.id),
          eq(t.setLogs.completed, true),
        ),
      );
    if (sets.length === 0) continue;

    let best1rmSet = sets[0]!;
    let best1rm = 0;
    let topWeightSet = sets[0]!;
    for (const s of sets) {
      const e = estimate1RM(s.weight, s.reps);
      if (e > best1rm) {
        best1rm = e;
        best1rmSet = s;
      }
      if (s.weight > topWeightSet.weight) topWeightSet = s;
    }
    best1rm = Math.round(best1rm);

    const [prior1rm] = await db
      .select()
      .from(t.personalRecords)
      .where(
        and(
          eq(t.personalRecords.exerciseId, se.exerciseId),
          eq(t.personalRecords.type, "1rm"),
        ),
      )
      .orderBy(desc(t.personalRecords.value))
      .limit(1);
    if (best1rm > 0 && (!prior1rm || best1rm > prior1rm.value)) {
      await insertRow(t.personalRecords, {
        ownerId: args.ownerId,
        exerciseId: se.exerciseId,
        type: "1rm",
        value: best1rm,
        sessionId: args.sessionId,
        achievedAt: args.now,
      });
      await db
        .update(t.setLogs)
        .set({ isPr: true })
        .where(eq(t.setLogs.id, best1rmSet.id));
      found.push({ exerciseId: se.exerciseId, type: "1rm", value: best1rm });
    }

    const [priorW] = await db
      .select()
      .from(t.personalRecords)
      .where(
        and(
          eq(t.personalRecords.exerciseId, se.exerciseId),
          eq(t.personalRecords.type, "weight"),
        ),
      )
      .orderBy(desc(t.personalRecords.value))
      .limit(1);
    if (
      topWeightSet.weight > 0 &&
      (!priorW || topWeightSet.weight > priorW.value)
    ) {
      await insertRow(t.personalRecords, {
        ownerId: args.ownerId,
        exerciseId: se.exerciseId,
        type: "weight",
        value: topWeightSet.weight,
        sessionId: args.sessionId,
        achievedAt: args.now,
      });
      await db
        .update(t.setLogs)
        .set({ isPr: true })
        .where(eq(t.setLogs.id, topWeightSet.id));
      found.push({
        exerciseId: se.exerciseId,
        type: "weight",
        value: topWeightSet.weight,
      });
    }
  }
  return found;
}

/* ---------------------------------------------------------------------------
 * Body weight
 * ------------------------------------------------------------------------- */

/** Log a bodyweight entry into bodyMetrics. */
export async function logBodyweight(args: {
  ownerId: string;
  weightKg: number;
  now: number;
  note?: string;
}) {
  return insertRow(t.bodyMetrics, {
    ownerId: args.ownerId,
    weightKg: args.weightKg,
    date: args.now,
    note: args.note,
  });
}

/** Add a body-weight entry. Weight canonical (kg); loggedAt epoch ms. */
export async function addBodyWeightLog(args: {
  ownerId: string;
  weightKg: number;
  loggedAt: number;
}) {
  return insertRow(t.bodyWeightLogs, {
    ownerId: args.ownerId,
    weightKg: args.weightKg,
    loggedAt: args.loggedAt,
  });
}

/** Body-weight entries within [from, to] epoch ms (inclusive), oldest→newest. */
export async function bodyWeightLogsInRange(args: {
  ownerId: string;
  from: number;
  to: number;
}) {
  return db
    .select()
    .from(t.bodyWeightLogs)
    .where(
      and(
        eq(t.bodyWeightLogs.ownerId, args.ownerId),
        gte(t.bodyWeightLogs.loggedAt, args.from),
        lte(t.bodyWeightLogs.loggedAt, args.to),
      ),
    )
    .orderBy(asc(t.bodyWeightLogs.loggedAt));
}

/** Most recent body-weight entry, or null if none. */
export async function latestBodyWeightLog(ownerId: string) {
  const [row] = await db
    .select()
    .from(t.bodyWeightLogs)
    .where(eq(t.bodyWeightLogs.ownerId, ownerId))
    .orderBy(desc(t.bodyWeightLogs.loggedAt))
    .limit(1);
  return row ?? null;
}

/* ---------------------------------------------------------------------------
 * Profile + settings — one row per user.
 * ------------------------------------------------------------------------- */

export interface ProfilePatch {
  displayName?: string;
  photoUrl?: string;
  heightCm?: number;
  currentWeightKg?: number;
  goalWeightKg?: number;
  trainingGoal?: TrainingGoal;
  unitPreference?: UnitPreference;
  defaultRestSec?: number;
  defaultSets?: number;
  defaultReps?: number;
}

/** The current user's profile, creating a default row if none exists. */
export async function getProfile(ownerId: string) {
  const [existing] = await db
    .select()
    .from(t.userProfile)
    .where(eq(t.userProfile.ownerId, ownerId))
    .limit(1);
  if (existing) return existing;
  return insertRow(t.userProfile, { ownerId });
}

/** Update allowed profile fields. Ensures the row exists first. */
export async function updateProfile(ownerId: string, patch: ProfilePatch) {
  const profile = await getProfile(ownerId);
  const set: Record<string, unknown> = {};
  if (patch.displayName !== undefined) set.displayName = patch.displayName;
  if (patch.photoUrl !== undefined) set.photoUrl = patch.photoUrl;
  if (patch.heightCm !== undefined) set.heightCm = patch.heightCm;
  if (patch.currentWeightKg !== undefined)
    set.currentWeightKg = patch.currentWeightKg;
  if (patch.goalWeightKg !== undefined) set.goalWeightKg = patch.goalWeightKg;
  if (patch.trainingGoal !== undefined) set.trainingGoal = patch.trainingGoal;
  if (patch.unitPreference !== undefined)
    set.unitPreference = patch.unitPreference;
  if (patch.defaultRestSec !== undefined)
    set.defaultRestSec = patch.defaultRestSec;
  if (patch.defaultSets !== undefined) set.defaultSets = patch.defaultSets;
  if (patch.defaultReps !== undefined) set.defaultReps = patch.defaultReps;
  if (Object.keys(set).length === 0) return profile;
  const [row] = await db
    .update(t.userProfile)
    .set(set)
    .where(eq(t.userProfile.id, profile.id))
    .returning();
  return row;
}

/** Log a body-weight entry and mirror it onto the profile's currentWeightKg. */
export async function logBodyWeight(args: {
  ownerId: string;
  weightKg: number;
  loggedAt: number;
}) {
  const log = await addBodyWeightLog(args);
  await updateProfile(args.ownerId, { currentWeightKg: args.weightKg });
  return log;
}

export interface ExerciseStatPoint {
  sessionId: string;
  date: number;
  best1rm: number;
  volume: number;
  topWeight: number;
}

/** Per-session stats for one exercise across finished sessions, oldest→newest. */
export async function exerciseStats(
  exerciseId: string,
): Promise<ExerciseStatPoint[]> {
  const ses = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.exerciseId, exerciseId));
  if (ses.length === 0) return [];

  const sessions = await db.select().from(t.sessions);
  const byId = new Map(sessions.map((s) => [s.id, s]));

  const points: ExerciseStatPoint[] = [];
  for (const se of ses) {
    const session = byId.get(se.sessionId);
    if (!session || session.endedAt == null) continue;
    const sets = await db
      .select()
      .from(t.setLogs)
      .where(
        and(
          eq(t.setLogs.sessionExerciseId, se.id),
          eq(t.setLogs.completed, true),
        ),
      );
    if (sets.length === 0) continue;
    let best1rm = 0;
    let volume = 0;
    let topWeight = 0;
    for (const s of sets) {
      best1rm = Math.max(best1rm, estimate1RM(s.weight, s.reps));
      volume += s.weight * s.reps;
      topWeight = Math.max(topWeight, s.weight);
    }
    points.push({
      sessionId: se.sessionId,
      date: session.startedAt,
      best1rm: Math.round(best1rm),
      volume,
      topWeight,
    });
  }
  return points.sort((a, b) => a.date - b.date);
}

/* ---------------------------------------------------------------------------
 * Routines (saved plan tree)
 * ------------------------------------------------------------------------- */

export async function createRoutine(args: {
  ownerId: string;
  name: string;
  order?: number;
  category?: string;
}) {
  return insertRow(t.routines, {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
    category: args.category,
  });
}

export async function renameRoutine(id: string, name: string) {
  await db.update(t.routines).set({ name }).where(eq(t.routines.id, id));
}

/** Set (or clear) a routine's free-text focus/split tag (Push, Pull, Legs…). */
export async function setRoutineCategory(id: string, category?: string) {
  const value = category?.trim() || null;
  await db
    .update(t.routines)
    .set({ category: value })
    .where(eq(t.routines.id, id));
}

/** Set the weekdays a routine is scheduled for (0=Sun … 6=Sat). */
export async function setRoutineSchedule(id: string, days: number[]) {
  const clean = [...new Set(days)].filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6,
  );
  await db
    .update(t.routines)
    .set({ scheduledDays: clean })
    .where(eq(t.routines.id, id));
}

/**
 * Delete a routine and everything that hangs off it. FK cascades handle the
 * prescription tree (routineExercises → routineSets); referencing program days
 * and history sessions are SET NULL (`routineId` back-refs), so a deleted
 * routine never leaves dangling refs.
 */
export async function deleteRoutine(id: string) {
  await db.delete(t.routines).where(eq(t.routines.id, id));
}

export async function addRoutineExercise(args: {
  routineId: string;
  exerciseId: string;
  order: number;
  restSec?: number;
}) {
  return insertRow(t.routineExercises, {
    ownerId: await ownerOf(t.routines, args.routineId),
    routineId: args.routineId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec: args.restSec ?? 120,
  });
}

/** Add an exercise to a routine pre-filled from the user's profile defaults. */
export async function addRoutineExerciseWithDefaults(args: {
  routineId: string;
  exerciseId: string;
  order: number;
  ownerId: string;
}) {
  const profile = await getProfile(args.ownerId);
  const sets = profile.defaultSets ?? 3;
  const reps = profile.defaultReps ?? 10;
  const restSec = profile.defaultRestSec ?? 120;

  const re = await addRoutineExercise({
    routineId: args.routineId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec,
  });
  for (let i = 0; i < sets; i++) {
    await addRoutineSet({
      routineExerciseId: re.id,
      order: i + 1,
      targetReps: reps,
    });
  }
  return re;
}

/** Remove an exercise from a routine, including its sets (FK cascade). */
export async function removeRoutineExercise(id: string) {
  await db.delete(t.routineExercises).where(eq(t.routineExercises.id, id));
}

export async function addRoutineSet(args: {
  routineExerciseId: string;
  order: number;
  targetReps?: number;
  targetWeight?: number;
  type?: string;
}) {
  return insertRow(t.routineSets, {
    ownerId: await ownerOf(t.routineExercises, args.routineExerciseId),
    routineExerciseId: args.routineExerciseId,
    order: args.order,
    type: args.type ?? "normal",
    targetReps: args.targetReps,
    targetWeight: args.targetWeight,
  });
}

export async function updateRoutineSet(
  id: string,
  patch: { targetReps?: number; targetWeight?: number },
) {
  const set: Record<string, unknown> = {};
  if (patch.targetReps !== undefined) set.targetReps = patch.targetReps;
  if (patch.targetWeight !== undefined) set.targetWeight = patch.targetWeight;
  if (Object.keys(set).length === 0) return;
  await db.update(t.routineSets).set(set).where(eq(t.routineSets.id, id));
}

export async function deleteRoutineSet(id: string) {
  await db.delete(t.routineSets).where(eq(t.routineSets.id, id));
}

/** Start a live session from a saved routine: deep-copy the prescription tree. */
export async function startSessionFromRoutine(args: {
  routineId: string;
  ownerId: string;
  programId?: string;
  now: number;
}) {
  const [routine] = await db
    .select()
    .from(t.routines)
    .where(eq(t.routines.id, args.routineId))
    .limit(1);
  const session = await insertRow(t.sessions, {
    ownerId: args.ownerId,
    routineId: args.routineId,
    programId: args.programId,
    name: routine?.name ?? "Workout",
    startedAt: args.now,
  });

  const exs = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, args.routineId))
    .orderBy(asc(t.routineExercises.order));
  for (const ex of exs) {
    const se = await insertRow(t.sessionExercises, {
      ownerId: args.ownerId,
      sessionId: session.id,
      exerciseId: ex.exerciseId,
      order: ex.order,
      supersetGroup: ex.supersetGroup,
      restSec: ex.restSec,
    });
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, ex.id))
      .orderBy(asc(t.routineSets.order));
    for (const rs of sets) {
      await insertRow(t.setLogs, {
        ownerId: args.ownerId,
        sessionExerciseId: se.id,
        order: rs.order,
        type: rs.type,
        weight: rs.targetWeight ?? 0,
        reps: rs.targetReps ?? 0,
        completed: false,
      });
    }
  }
  return session;
}

/**
 * Duplicate a routine, deep-cloning exercises + sets. Defaults to a fresh
 * "(copy)" / "(copy N)" name; pass an explicit `name` to use it verbatim — the
 * program-scoped save-back fork reuses the original name (no "(copy)" suffix).
 */
export async function duplicateRoutine(args: {
  routineId: string;
  ownerId: string;
  /** Explicit name for the copy; when omitted, escalates a "(copy)" suffix. */
  name?: string;
}): Promise<string | null> {
  const [src] = await db
    .select()
    .from(t.routines)
    .where(eq(t.routines.id, args.routineId))
    .limit(1);
  if (!src) return null;

  let name = args.name?.trim();
  if (!name) {
    const existing = await db
      .select()
      .from(t.routines)
      .where(eq(t.routines.ownerId, args.ownerId));
    const names = new Set(existing.map((r) => r.name));
    name = `${src.name} (copy)`;
    for (let n = 2; names.has(name); n++) name = `${src.name} (copy ${n})`;
  }

  const copy = await insertRow(t.routines, {
    ownerId: args.ownerId,
    name,
    notes: src.notes,
    order: src.order ?? 0,
    scheduledDays: src.scheduledDays ?? null,
  });

  const exs = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, args.routineId))
    .orderBy(asc(t.routineExercises.order));
  for (const ex of exs) {
    const re = await insertRow(t.routineExercises, {
      ownerId: args.ownerId,
      routineId: copy.id,
      exerciseId: ex.exerciseId,
      order: ex.order,
      supersetGroup: ex.supersetGroup,
      restSec: ex.restSec,
      notes: ex.notes,
    });
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, ex.id))
      .orderBy(asc(t.routineSets.order));
    for (const s of sets) {
      await insertRow(t.routineSets, {
        ownerId: args.ownerId,
        routineExerciseId: re.id,
        order: s.order,
        type: s.type,
        targetReps: s.targetReps,
        targetWeight: s.targetWeight,
        targetRpe: s.targetRpe,
        tempo: s.tempo,
      });
    }
  }
  return copy.id;
}

/* ---------------------------------------------------------------------------
 * Save-back — push a finished session's changes back into its routine.
 * ------------------------------------------------------------------------- */

export type SaveBackMode = "numbers" | "exercises" | "everything";

interface PlanEntry {
  exerciseId: string;
  supersetGroup?: number;
  restSec?: number;
  sets: Array<{
    type?: string;
    targetWeight?: number;
    targetReps?: number;
    targetRpe?: number;
    tempo?: string;
  }>;
}

/** Rewrite a routine's prescription from a finished session, per mode. */
export async function applySessionToRoutine(args: {
  sessionId: string;
  routineId: string;
  mode: SaveBackMode;
}) {
  const ses = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, args.sessionId))
    .orderBy(asc(t.sessionExercises.order));
  const performed: PlanEntry[] = [];
  for (const se of ses) {
    const sets = await db
      .select()
      .from(t.setLogs)
      .where(eq(t.setLogs.sessionExerciseId, se.id))
      .orderBy(asc(t.setLogs.order));
    performed.push({
      exerciseId: se.exerciseId,
      supersetGroup: se.supersetGroup ?? undefined,
      restSec: se.restSec ?? undefined,
      sets: sets.map((s) => ({
        type: s.type,
        targetWeight: s.weight || undefined,
        targetReps: s.reps || undefined,
        targetRpe: s.rpe ?? undefined,
      })),
    });
  }

  const oldEx = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, args.routineId))
    .orderBy(asc(t.routineExercises.order));
  const oldPlan: PlanEntry[] = [];
  const oldSetsByExerciseId = new Map<string, PlanEntry["sets"]>();
  for (const re of oldEx) {
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, re.id))
      .orderBy(asc(t.routineSets.order));
    const entry: PlanEntry = {
      exerciseId: re.exerciseId,
      supersetGroup: re.supersetGroup ?? undefined,
      restSec: re.restSec ?? undefined,
      sets: sets.map((s) => ({
        type: s.type,
        targetWeight: s.targetWeight ?? undefined,
        targetReps: s.targetReps ?? undefined,
        targetRpe: s.targetRpe ?? undefined,
        tempo: s.tempo ?? undefined,
      })),
    };
    oldPlan.push(entry);
    if (!oldSetsByExerciseId.has(re.exerciseId))
      oldSetsByExerciseId.set(re.exerciseId, entry.sets);
  }

  let plan: PlanEntry[];
  if (args.mode === "everything") {
    plan = performed;
  } else if (args.mode === "numbers") {
    const performedByExId = new Map(
      performed.map((p) => [p.exerciseId, p.sets]),
    );
    plan = oldPlan.map((o) => ({
      ...o,
      sets: performedByExId.get(o.exerciseId) ?? o.sets,
    }));
  } else {
    plan = performed.map((p) => ({
      exerciseId: p.exerciseId,
      supersetGroup: p.supersetGroup,
      restSec: p.restSec,
      sets: oldSetsByExerciseId.get(p.exerciseId) ?? p.sets,
    }));
  }

  const ownerId = await ownerOf(t.routines, args.routineId);
  // Replace the routine tree (routineSets cascade with their exercise).
  await db
    .delete(t.routineExercises)
    .where(eq(t.routineExercises.routineId, args.routineId));
  let order = 1;
  for (const entry of plan) {
    const re = await insertRow(t.routineExercises, {
      ownerId,
      routineId: args.routineId,
      exerciseId: entry.exerciseId,
      order: order++,
      supersetGroup: entry.supersetGroup,
      restSec: entry.restSec ?? 120,
    });
    let so = 1;
    for (const s of entry.sets) {
      await insertRow(t.routineSets, {
        ownerId,
        routineExerciseId: re.id,
        order: so++,
        type: s.type ?? "normal",
        targetReps: s.targetReps,
        targetWeight: s.targetWeight,
        targetRpe: s.targetRpe,
        tempo: s.tempo,
      });
    }
  }
}

export interface SaveBackContext {
  routineId: string;
  routineName: string;
  prescription: DiffExercise[];
  performed: DiffExercise[];
  program: { programDayId: string; programName: string } | null;
}

/** Gather everything the finish flow needs to offer save-back. */
export async function getSaveBackContext(
  sessionId: string,
): Promise<SaveBackContext | null> {
  const [session] = await db
    .select()
    .from(t.sessions)
    .where(eq(t.sessions.id, sessionId))
    .limit(1);
  if (!session?.routineId) return null;
  const [routine] = await db
    .select()
    .from(t.routines)
    .where(eq(t.routines.id, session.routineId))
    .limit(1);
  if (!routine) return null;

  const presEx = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, session.routineId))
    .orderBy(asc(t.routineExercises.order));
  const prescription: DiffExercise[] = [];
  for (const re of presEx) {
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, re.id))
      .orderBy(asc(t.routineSets.order));
    prescription.push({
      exerciseId: re.exerciseId,
      sets: sets.map((s) => ({
        weight: s.targetWeight ?? 0,
        reps: s.targetReps ?? 0,
      })),
    });
  }

  const ses = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, sessionId))
    .orderBy(asc(t.sessionExercises.order));
  const performed: DiffExercise[] = [];
  for (const se of ses) {
    const sets = await db
      .select()
      .from(t.setLogs)
      .where(eq(t.setLogs.sessionExerciseId, se.id))
      .orderBy(asc(t.setLogs.order));
    performed.push({
      exerciseId: se.exerciseId,
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
    });
  }

  let program: SaveBackContext["program"] = null;
  const actives = await db
    .select()
    .from(t.programs)
    .where(
      and(eq(t.programs.ownerId, session.ownerId), eq(t.programs.active, true)),
    );
  for (const pr of actives) {
    const [day] = await db
      .select()
      .from(t.programDays)
      .where(
        and(
          eq(t.programDays.programId, pr.id),
          eq(t.programDays.routineId, session.routineId),
        ),
      )
      .limit(1);
    if (day) {
      program = { programDayId: day.id, programName: pr.name };
      break;
    }
  }

  return {
    routineId: session.routineId,
    routineName: routine.name,
    prescription,
    performed,
    program,
  };
}

/* ---------------------------------------------------------------------------
 * Programs (ordered named days, each mapped to a routine)
 * ------------------------------------------------------------------------- */

export async function createProgram(args: {
  ownerId: string;
  name: string;
  order?: number;
  blockWeeks?: number;
}) {
  const created = await insertRow(t.programs, {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
    blockWeeks: args.blockWeeks,
  });
  // First/only program becomes active by default so Home always drives "today".
  const all = await db
    .select()
    .from(t.programs)
    .where(eq(t.programs.ownerId, args.ownerId));
  if (all.length === 1) {
    const now = Date.now();
    await db
      .update(t.programs)
      .set({ active: true, activatedAt: now })
      .where(eq(t.programs.id, created.id));
    created.active = true;
    created.activatedAt = now;
  }
  return created;
}

export async function renameProgram(id: string, name: string) {
  await db.update(t.programs).set({ name }).where(eq(t.programs.id, id));
}

/**
 * Mark one program active (clears the flag on the owner's others). Stamps
 * `activatedAt` on the program transitioning into active so the dashboard's
 * week-block bar anchors to "now"; re-activating the already-active program is
 * a no-op and leaves its anchor untouched.
 */
export async function setProgramActive(args: {
  programId: string;
  ownerId: string;
  now?: number;
}) {
  const now = args.now ?? Date.now();
  const all = await db
    .select()
    .from(t.programs)
    .where(eq(t.programs.ownerId, args.ownerId));
  for (const p of all) {
    const shouldBe = p.id === args.programId;
    if (!!p.active !== shouldBe) {
      await db
        .update(t.programs)
        .set(shouldBe ? { active: true, activatedAt: now } : { active: false })
        .where(eq(t.programs.id, p.id));
    }
  }
}

/** Patch a program's schedule mode, rotation cursor, and/or block length. */
export async function setProgramSchedule(
  id: string,
  patch: {
    scheduleMode?: "rotation" | "weekly";
    rotationCursor?: number;
    blockWeeks?: number;
  },
) {
  const set: Record<string, unknown> = {};
  if (patch.scheduleMode !== undefined) set.scheduleMode = patch.scheduleMode;
  if (patch.rotationCursor !== undefined)
    set.rotationCursor = patch.rotationCursor;
  if ("blockWeeks" in patch)
    set.blockWeeks = patch.blockWeeks ? patch.blockWeeks : null;
  if (Object.keys(set).length === 0) return;
  await db.update(t.programs).set(set).where(eq(t.programs.id, id));
}

export async function deleteProgram(id: string) {
  await db.delete(t.programs).where(eq(t.programs.id, id));
}

export async function addProgramDay(args: {
  programId: string;
  order: number;
  name?: string;
  routineId?: string;
  weekday?: number;
}) {
  return insertRow(t.programDays, {
    ownerId: await ownerOf(t.programs, args.programId),
    programId: args.programId,
    order: args.order,
    name: args.name ?? `Day ${args.order}`,
    routineId: args.routineId,
    weekday: args.weekday,
  });
}

export async function updateProgramDay(
  id: string,
  patch: { name?: string; routineId?: string; weekday?: number },
) {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name;
  // `"routineId" in patch` so callers can CLEAR the assignment (→ Rest slot).
  if ("routineId" in patch) set.routineId = patch.routineId ?? null;
  if (patch.weekday !== undefined) set.weekday = patch.weekday;
  if (Object.keys(set).length === 0) return;
  await db.update(t.programDays).set(set).where(eq(t.programDays.id, id));
}

export async function removeProgramDay(id: string) {
  await db.delete(t.programDays).where(eq(t.programDays.id, id));
}

/** Persist a full reorder: `order` becomes the 1-based position in `orderedIds`. */
export async function reorderProgramDays(orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(t.programDays)
        .set({ order: i + 1 })
        .where(eq(t.programDays.id, id)),
    ),
  );
}

/* ---------------------------------------------------------------------------
 * Social — publish a routine to the shared catalog; clone someone else's.
 * ------------------------------------------------------------------------- */

interface SharedSnapshotExercise {
  exerciseId: string;
  name: string;
  sets: { reps: number; weight: number }[];
}

/** Snapshot a routine into the public catalog so others can discover + clone it. */
export async function publishRoutine(args: {
  routineId: string;
  ownerId: string;
  authorName: string;
  now: number;
}) {
  const [routine] = await db
    .select()
    .from(t.routines)
    .where(eq(t.routines.id, args.routineId))
    .limit(1);
  if (!routine) return null;

  const exs = await db
    .select({
      id: t.routineExercises.id,
      exerciseId: t.routineExercises.exerciseId,
      order: t.routineExercises.order,
      name: t.exercises.name,
    })
    .from(t.routineExercises)
    .leftJoin(t.exercises, eq(t.routineExercises.exerciseId, t.exercises.id))
    .where(eq(t.routineExercises.routineId, args.routineId))
    .orderBy(asc(t.routineExercises.order));
  const snapshot: SharedSnapshotExercise[] = [];
  for (const ex of exs) {
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, ex.id))
      .orderBy(asc(t.routineSets.order));
    snapshot.push({
      exerciseId: ex.exerciseId,
      name: ex.name ?? "Exercise",
      sets: sets.map((s) => ({
        reps: s.targetReps ?? 0,
        weight: s.targetWeight ?? 0,
      })),
    });
  }

  return insertRow(t.sharedRoutines, {
    ownerId: args.ownerId,
    authorName: args.authorName,
    name: routine.name,
    exercisesJson: JSON.stringify(snapshot),
    exerciseCount: snapshot.length,
    createdAt: args.now,
  });
}

export interface SharedRoutineRow {
  id: string;
  name: string;
  authorName: string;
  exercisesJson: string;
  exerciseCount: number;
}

/** Clone a shared routine into the user's own routines. Returns the new routine id. */
export async function cloneSharedRoutine(args: {
  shared: SharedRoutineRow;
  ownerId: string;
}): Promise<string> {
  const snapshot = JSON.parse(
    args.shared.exercisesJson,
  ) as SharedSnapshotExercise[];
  const routine = await createRoutine({
    ownerId: args.ownerId,
    name: args.shared.name,
  });
  for (let i = 0; i < snapshot.length; i++) {
    const ex = snapshot[i]!;
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: ex.exerciseId,
      order: i + 1,
    });
    for (let s = 0; s < ex.sets.length; s++) {
      const set = ex.sets[s]!;
      await addRoutineSet({
        routineExerciseId: re.id,
        order: s + 1,
        targetReps: set.reps,
        targetWeight: set.weight || undefined,
      });
    }
  }
  return routine.id;
}

/* ---------------------------------------------------------------------------
 * History / progression helpers
 * ------------------------------------------------------------------------- */

export interface PrevSet {
  order: number;
  weight: number;
  reps: number;
}

/** Last completed performance of an exercise in a prior finished session. */
export async function lastPerformance(args: {
  exerciseId: string;
  excludeSessionId?: string;
}): Promise<PrevSet[] | null> {
  const seRows = await db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.exerciseId, args.exerciseId));
  if (seRows.length === 0) return null;

  const sessions = await db.select().from(t.sessions);
  const startedById = new Map(sessions.map((s) => [s.id, s]));

  const candidates = seRows
    .map((se) => ({ se, session: startedById.get(se.sessionId) }))
    .filter(
      (c) =>
        c.session &&
        c.session.id !== args.excludeSessionId &&
        c.session.endedAt != null,
    )
    .sort((a, b) => (b.session!.startedAt ?? 0) - (a.session!.startedAt ?? 0));

  const best = candidates[0];
  if (!best) return null;

  const sets = await db
    .select()
    .from(t.setLogs)
    .where(
      and(
        eq(t.setLogs.sessionExerciseId, best.se.id),
        eq(t.setLogs.completed, true),
      ),
    )
    .orderBy(asc(t.setLogs.order));
  if (sets.length === 0) return null;
  return sets.map((s) => ({ order: s.order, weight: s.weight, reps: s.reps }));
}

/** Discard a session entirely (FK cascade clears its exercises + set logs). */
export async function discardSession(sessionId: string) {
  await db.delete(t.sessions).where(eq(t.sessions.id, sessionId));
}

/* ---------------------------------------------------------------------------
 * Web Push — device subscriptions + the scheduled-push queue.
 * ------------------------------------------------------------------------- */

/** Store (or refresh) a device's push subscription, deduped by `endpoint`. */
export async function savePushSubscription(args: {
  ownerId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  now: number;
}) {
  const [existing] = await db
    .select()
    .from(t.pushSubscriptions)
    .where(eq(t.pushSubscriptions.endpoint, args.endpoint))
    .limit(1);
  if (existing) {
    const set: Record<string, unknown> = {
      ownerId: args.ownerId,
      p256dh: args.p256dh,
      auth: args.auth,
    };
    if (args.userAgent !== undefined) set.userAgent = args.userAgent;
    const [row] = await db
      .update(t.pushSubscriptions)
      .set(set)
      .where(eq(t.pushSubscriptions.id, existing.id))
      .returning();
    return row;
  }
  return insertRow(t.pushSubscriptions, {
    ownerId: args.ownerId,
    endpoint: args.endpoint,
    p256dh: args.p256dh,
    auth: args.auth,
    userAgent: args.userAgent,
    createdAt: args.now,
  });
}

/** All push subscriptions (devices) for a user. */
export async function getPushSubscriptions(ownerId: string) {
  return db
    .select()
    .from(t.pushSubscriptions)
    .where(eq(t.pushSubscriptions.ownerId, ownerId));
}

/** Remove a stored subscription (e.g. the push service reported it expired). */
export async function deletePushSubscription(id: string) {
  await db.delete(t.pushSubscriptions).where(eq(t.pushSubscriptions.id, id));
}

/** Queue a push for `fireAt`. Returns the row so the caller can reschedule/cancel it. */
export async function schedulePush(args: {
  ownerId: string;
  subscriptionId: string;
  fireAt: number;
  title: string;
  body: string;
  now: number;
}) {
  return insertRow(t.scheduledPushes, {
    ownerId: args.ownerId,
    subscriptionId: args.subscriptionId,
    fireAt: args.fireAt,
    title: args.title,
    body: args.body,
    status: "pending",
    createdAt: args.now,
  });
}

/** Move a still-pending scheduled push to a new fire time (rest +/- time). */
export async function reschedulePush(id: string, fireAt: number) {
  await db
    .update(t.scheduledPushes)
    .set({ fireAt })
    .where(
      and(
        eq(t.scheduledPushes.id, id),
        eq(t.scheduledPushes.status, "pending"),
      ),
    );
}

/** Cancel a scheduled push (rest skipped, or fired locally in the foreground). */
export async function cancelScheduledPush(id: string) {
  await db.delete(t.scheduledPushes).where(eq(t.scheduledPushes.id, id));
}

/** A pending scheduled push with its target subscription resolved. */
export interface PendingPushRow extends ScheduledPush {
  subscription: PushSubscriptionRecord | null;
}

/**
 * Every pending push (across all owners), each with its target `subscription`
 * joined so the sender has endpoint+keys in one read. The server-side sender
 * (apps/push) polls this; it decides *when* to deliver by comparing `fireAt` to
 * the wall clock. One-shot — replaces the old Triplit live subscription.
 */
export async function getPendingPushes(): Promise<PendingPushRow[]> {
  const rows = await db
    .select()
    .from(t.scheduledPushes)
    .leftJoin(
      t.pushSubscriptions,
      eq(t.scheduledPushes.subscriptionId, t.pushSubscriptions.id),
    )
    .where(eq(t.scheduledPushes.status, "pending"));
  return rows.map((r) => ({
    ...(r.scheduled_pushes as unknown as ScheduledPush),
    subscription:
      (r.push_subscriptions as unknown as PushSubscriptionRecord | null) ??
      null,
  }));
}

/** Mark a scheduled push delivered so the sender never sends it twice. */
export async function markPushSent(id: string) {
  await db
    .update(t.scheduledPushes)
    .set({ status: "sent" })
    .where(eq(t.scheduledPushes.id, id));
}

/* ---------------------------------------------------------------------------
 * Account deletion
 * ------------------------------------------------------------------------- */

/**
 * Permanently delete everything an owner owns — the data half of account
 * deletion. Runs in ONE transaction (all-or-nothing). DB cascades take care of
 * the child trees (sessions→sessionExercises→setLogs, routines→routineExercises
 * →routineSets, programs→programDays, pushSubscriptions→scheduledPushes), so we
 * only delete the roots, then the standalone owner-scoped tables.
 *
 * Two deliberate exceptions:
 *  - `sharedRoutines` are LEFT in place — they're self-contained public snapshots
 *    that should survive the author leaving (caller's product choice).
 *  - Custom `exercises` are removed only when NO routine/session still references
 *    them. Importing a shared routine reuses the author's `exerciseId`
 *    (see `importShared`), so another user may point at this owner's custom
 *    exercise; deleting it would orphan their plan, so we keep referenced ones.
 *
 * The Supabase auth user itself is deleted separately by the caller (needs the
 * service-role admin API, which lives in the web app, not here).
 */
export async function deleteAccountData(ownerId: string) {
  await db.transaction(async (tx) => {
    // Roots first — cascades clear their owned child rows.
    await tx.delete(t.sessions).where(eq(t.sessions.ownerId, ownerId));
    await tx.delete(t.routines).where(eq(t.routines.ownerId, ownerId));
    await tx.delete(t.programs).where(eq(t.programs.ownerId, ownerId));
    await tx
      .delete(t.pushSubscriptions)
      .where(eq(t.pushSubscriptions.ownerId, ownerId));
    // Standalone owner-scoped tables (no cascade parent).
    await tx
      .delete(t.personalRecords)
      .where(eq(t.personalRecords.ownerId, ownerId));
    await tx.delete(t.bodyMetrics).where(eq(t.bodyMetrics.ownerId, ownerId));
    await tx
      .delete(t.bodyWeightLogs)
      .where(eq(t.bodyWeightLogs.ownerId, ownerId));
    await tx.delete(t.userProfile).where(eq(t.userProfile.ownerId, ownerId));
    // Custom exercises — only those no surviving routine/session references.
    await tx.delete(t.exercises).where(
      and(
        eq(t.exercises.ownerId, ownerId),
        eq(t.exercises.isCustom, true),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(t.routineExercises)
            .where(eq(t.routineExercises.exerciseId, t.exercises.id)),
        ),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(t.sessionExercises)
            .where(eq(t.sessionExercises.exerciseId, t.exercises.id)),
        ),
      ),
    );
  });
}
