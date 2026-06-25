import { TriplitClient } from "@triplit/client";
import { estimate1RM } from "@rackd/core";
import type {
  TrainingGoal,
  UnitPreference,
  DiffExercise,
  ScheduledPush,
  PushSubscriptionRecord,
} from "@rackd/core";
import { schema, roles } from "./schema";

export { schema, roles } from "./schema";
export type { Schema } from "./schema";
export { SEED_EXERCISES, seedExercises } from "./seed";
export type { SeedExercise } from "./seed";
export { PROGRAM_TEMPLATES, cloneProgramTemplate } from "./templates";
export type { ProgramTemplate } from "./templates";

/**
 * Single client factory (DRY). Apps create one client; UI never touches
 * Triplit directly — go through the repository functions below.
 */
export function createClient(opts?: {
  serverUrl?: string;
  token?: string;
  /** "memory" (default) or "indexeddb" for persistent local-first storage. */
  storage?: "memory" | "indexeddb";
  /** IndexedDB database name. */
  dbName?: string;
}) {
  return new TriplitClient({
    schema,
    roles,
    serverUrl: opts?.serverUrl,
    token: opts?.token,
    storage:
      opts?.storage === "indexeddb"
        ? { type: "indexeddb", name: opts?.dbName ?? "myfit" }
        : opts?.storage,
    autoConnect: Boolean(opts?.serverUrl),
    // Push the client schema (incl. relationships) so server-side queries like
    // .Include("exercise") are valid. Needed for our self-hosted schemaless server.
    syncSchema: Boolean(opts?.serverUrl),
  });
}

export type Client = ReturnType<typeof createClient>;

/**
 * Repository layer — one command function per intent. UI calls these,
 * not the client. Keeps mutations in one place and the engine swappable.
 */

/** Derive ownerId from a parent row so child collections stay owner-scoped (DRY). */
async function ownerOf(
  client: Client,
  collection: "sessions" | "sessionExercises" | "routines" | "routineExercises" | "programs",
  id: string,
): Promise<string> {
  const row = await client.fetchById(collection, id);
  return (row as { ownerId?: string } | null)?.ownerId ?? "";
}

export async function startSession(
  client: Client,
  args: { ownerId: string; routineId?: string; name: string; now: number },
) {
  return client.insert("sessions", {
    ownerId: args.ownerId,
    routineId: args.routineId,
    name: args.name,
    startedAt: args.now,
  });
}

/** Add an exercise to a live session (a session "card"). */
export async function addSessionExercise(
  client: Client,
  args: { sessionId: string; exerciseId: string; order: number; restSec?: number },
) {
  return client.insert("sessionExercises", {
    ownerId: await ownerOf(client, "sessions", args.sessionId),
    sessionId: args.sessionId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec: args.restSec ?? 120,
  });
}

export async function setSessionExerciseOrder(client: Client, id: string, order: number) {
  return client.update("sessionExercises", id, (e) => {
    e.order = order;
  });
}

/** Patch mutable fields of a live session exercise (currently its rest time). */
export async function updateSessionExercise(
  client: Client,
  id: string,
  patch: { restSec?: number },
) {
  return client.update("sessionExercises", id, (e) => {
    if (patch.restSec !== undefined) e.restSec = patch.restSec;
  });
}

export async function setRoutineExerciseOrder(client: Client, id: string, order: number) {
  return client.update("routineExercises", id, (e) => {
    e.order = order;
  });
}

/** Patch mutable fields of a routine exercise (currently its rest time). */
export async function updateRoutineExercise(
  client: Client,
  id: string,
  patch: { restSec?: number },
) {
  return client.update("routineExercises", id, (e) => {
    if (patch.restSec !== undefined) e.restSec = patch.restSec;
  });
}

/**
 * Persist a full reorder of a session's exercises: `order` becomes the 1-based
 * position in `orderedIds`. Only mutates `sessionExercises` — the source routine
 * is untouched (session is a deep copy of the plan).
 */
export async function reorderSessionExercises(client: Client, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      client.update("sessionExercises", id, (e) => {
        e.order = i + 1;
      }),
    ),
  );
}

/** Persist a full reorder: `order` becomes the 1-based position in `orderedIds`. */
export async function reorderRoutineExercises(client: Client, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      client.update("routineExercises", id, (e) => {
        e.order = i + 1;
      }),
    ),
  );
}

export async function setRoutineExerciseSuperset(
  client: Client,
  id: string,
  group: number | undefined,
) {
  return client.update("routineExercises", id, (e) => {
    e.supersetGroup = group;
  });
}

/**
 * Swap which library exercise a routine slot points at, keeping its order,
 * superset link, rest and prescribed sets. The `exercise` relation re-resolves
 * via `$exerciseId`, so the new name/media flow through automatically.
 */
export async function replaceRoutineExercise(
  client: Client,
  id: string,
  newExerciseId: string,
) {
  return client.update("routineExercises", id, (e) => {
    e.exerciseId = newExerciseId;
  });
}

/**
 * Swap which library exercise a live session slot points at, keeping its order
 * and rest. Mutates only `sessionExercises` — the source routine is untouched
 * (the session is a deep copy of the plan). The `exercise` relation re-resolves
 * via `$exerciseId`, so the new name/media flow through automatically.
 */
export async function replaceSessionExercise(
  client: Client,
  id: string,
  newExerciseId: string,
) {
  return client.update("sessionExercises", id, (e) => {
    e.exerciseId = newExerciseId;
  });
}

/** Remove an exercise from a live session, including its logged sets. */
export async function removeSessionExercise(client: Client, sessionExerciseId: string) {
  const sets = await client.fetch(
    client.query("setLogs").Where("sessionExerciseId", "=", sessionExerciseId),
  );
  for (const s of sets) await client.delete("setLogs", s.id);
  await client.delete("sessionExercises", sessionExerciseId);
}

/** Add an empty (uncompleted) set row to a session exercise. */
export async function addSet(
  client: Client,
  args: { sessionExerciseId: string; order: number; type?: string; weight?: number; reps?: number },
) {
  return client.insert("setLogs", {
    ownerId: await ownerOf(client, "sessionExercises", args.sessionExerciseId),
    sessionExerciseId: args.sessionExerciseId,
    order: args.order,
    type: args.type ?? "normal",
    weight: args.weight ?? 0,
    reps: args.reps ?? 0,
    completed: false,
  });
}

export async function updateSet(
  client: Client,
  id: string,
  patch: { weight?: number; reps?: number; rpe?: number; completed?: boolean },
) {
  return client.update("setLogs", id, (s) => {
    if (patch.weight !== undefined) s.weight = patch.weight;
    if (patch.reps !== undefined) s.reps = patch.reps;
    // `"rpe" in patch` (not `!== undefined`) so callers can CLEAR rpe by passing
    // `rpe: undefined`. Absent key = leave it untouched; present-but-undefined =
    // reset to no effort. Other fields stay guard-by-undefined so a partial
    // patch never nulls them.
    if ("rpe" in patch) s.rpe = patch.rpe;
    if (patch.completed !== undefined) s.completed = patch.completed;
  });
}

export async function deleteSet(client: Client, id: string) {
  return client.delete("setLogs", id);
}

export async function logSet(
  client: Client,
  args: {
    sessionExerciseId: string;
    order: number;
    weight: number;
    reps: number;
    rpe?: number;
    type?: string;
  },
) {
  return client.insert("setLogs", {
    ownerId: await ownerOf(client, "sessionExercises", args.sessionExerciseId),
    sessionExerciseId: args.sessionExerciseId,
    order: args.order,
    weight: args.weight,
    reps: args.reps,
    rpe: args.rpe,
    type: args.type ?? "normal",
    completed: true,
  });
}

export async function finishSession(client: Client, sessionId: string, now: number) {
  await client.update("sessions", sessionId, (s) => {
    s.endedAt = now;
  });
  const session = await client.fetchById("sessions", sessionId);
  if (session) {
    // Rest is config/prescription (not performance), so carry an in-workout
    // rest edit back to the routine for the next run. Safe alongside the
    // optional save-back flow — both write the same session rest value.
    await syncRestToRoutine(client, sessionId);
    return detectAndRecordPRs(client, { sessionId, ownerId: session.ownerId, now });
  }
  return [];
}

/**
 * Carry per-exercise rest edits made during a live workout back to the source
 * routine so the next run starts from the same rest timers. ONLY the `restSec`
 * config is synced — performed sets/loads are never pushed to the routine
 * (that's the explicit, user-driven save-back flow).
 *
 * sessionExercises hold no link to their source routineExercise, so we map by
 * `exerciseId` within the session's `routineId`, using `order` to pair up when a
 * routine repeats the same exercise. Exercises added mid-session (no routine
 * slot) are skipped; removed ones keep their existing rest. No-ops for ad-hoc
 * sessions (no routineId).
 */
async function syncRestToRoutine(client: Client, sessionId: string) {
  const session = await client.fetchById("sessions", sessionId);
  if (!session?.routineId) return;

  const routineExs = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", session.routineId),
  );
  if (routineExs.length === 0) return;

  const sessionExs = await client.fetch(
    client.query("sessionExercises").Where("sessionId", "=", sessionId),
  );
  if (sessionExs.length === 0) return;

  // Group routine slots by exerciseId (order-sorted) to pair duplicates by position.
  const slotsByExId = new Map<string, typeof routineExs>();
  for (const re of routineExs) {
    const list = slotsByExId.get(re.exerciseId) ?? [];
    list.push(re);
    slotsByExId.set(re.exerciseId, list);
  }
  for (const list of slotsByExId.values()) list.sort((a, b) => a.order - b.order);

  const claimed = new Set<string>();
  const orderedSes = [...sessionExs].sort((a, b) => a.order - b.order);
  for (const se of orderedSes) {
    const slot = slotsByExId.get(se.exerciseId)?.find((re) => !claimed.has(re.id));
    if (!slot) continue; // added/replaced mid-session — no matching routine slot
    claimed.add(slot.id);
    if (slot.restSec !== se.restSec) {
      await client.update("routineExercises", slot.id, (re) => {
        re.restSec = se.restSec;
      });
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
 * personalRecords acts as the running ledger; the contributing set is flagged
 * isPr so history can badge it. Idempotent enough: re-running won't beat an
 * already-recorded equal best.
 */
export async function detectAndRecordPRs(
  client: Client,
  args: { sessionId: string; ownerId: string; now: number },
): Promise<DetectedPR[]> {
  const found: DetectedPR[] = [];
  const ses = await client.fetch(
    client.query("sessionExercises").Where("sessionId", "=", args.sessionId),
  );

  for (const se of ses) {
    const sets = await client.fetch(
      client
        .query("setLogs")
        .Where("sessionExerciseId", "=", se.id)
        .Where("completed", "=", true),
    );
    if (sets.length === 0) continue;

    // best set by estimated 1RM, and the heaviest set
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

    const prior1rm = await client.fetchOne(
      client
        .query("personalRecords")
        .Where("exerciseId", "=", se.exerciseId)
        .Where("type", "=", "1rm")
        .Order("value", "DESC"),
    );
    if (best1rm > 0 && (!prior1rm || best1rm > prior1rm.value)) {
      await client.insert("personalRecords", {
        ownerId: args.ownerId,
        exerciseId: se.exerciseId,
        type: "1rm",
        value: best1rm,
        sessionId: args.sessionId,
        achievedAt: args.now,
      });
      await client.update("setLogs", best1rmSet.id, (s) => {
        s.isPr = true;
      });
      found.push({ exerciseId: se.exerciseId, type: "1rm", value: best1rm });
    }

    const priorW = await client.fetchOne(
      client
        .query("personalRecords")
        .Where("exerciseId", "=", se.exerciseId)
        .Where("type", "=", "weight")
        .Order("value", "DESC"),
    );
    if (topWeightSet.weight > 0 && (!priorW || topWeightSet.weight > priorW.value)) {
      await client.insert("personalRecords", {
        ownerId: args.ownerId,
        exerciseId: se.exerciseId,
        type: "weight",
        value: topWeightSet.weight,
        sessionId: args.sessionId,
        achievedAt: args.now,
      });
      await client.update("setLogs", topWeightSet.id, (s) => {
        s.isPr = true;
      });
      found.push({ exerciseId: se.exerciseId, type: "weight", value: topWeightSet.weight });
    }
  }
  return found;
}

/** Log a bodyweight entry. */
export async function logBodyweight(
  client: Client,
  args: { ownerId: string; weightKg: number; now: number; note?: string },
) {
  return client.insert("bodyMetrics", {
    ownerId: args.ownerId,
    weightKg: args.weightKg,
    date: args.now,
    note: args.note,
  });
}

/* ---------------------------------------------------------------------------
 * Body-weight log — timestamped weight history for the progress chart.
 * ------------------------------------------------------------------------- */

/** Add a body-weight entry. Weight canonical (kg); loggedAt epoch ms. */
export async function addBodyWeightLog(
  client: Client,
  args: { ownerId: string; weightKg: number; loggedAt: number },
) {
  return client.insert("bodyWeightLogs", {
    ownerId: args.ownerId,
    weightKg: args.weightKg,
    loggedAt: args.loggedAt,
  });
}

/** Body-weight entries within [from, to] epoch ms (inclusive), oldest→newest. */
export async function bodyWeightLogsInRange(
  client: Client,
  args: { ownerId: string; from: number; to: number },
) {
  return client.fetch(
    client
      .query("bodyWeightLogs")
      .Where("ownerId", "=", args.ownerId)
      .Where("loggedAt", ">=", args.from)
      .Where("loggedAt", "<=", args.to)
      .Order("loggedAt", "ASC"),
  );
}

/** Most recent body-weight entry, or null if none. */
export async function latestBodyWeightLog(client: Client, ownerId: string) {
  return client.fetchOne(
    client
      .query("bodyWeightLogs")
      .Where("ownerId", "=", ownerId)
      .Order("loggedAt", "DESC"),
  );
}

/* ---------------------------------------------------------------------------
 * Profile + settings — one row per user. UI goes through these, never the
 * client directly. Weights canonical (kg), height cm.
 * ------------------------------------------------------------------------- */

/** Fields a caller may update; id/ownerId are immutable. */
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

/**
 * The current user's profile, creating a default row if none exists.
 * Defaults (unitPreference "metric", restSec 120, sets 3, reps 10) come from
 * the schema, so a bare insert is enough.
 */
export async function getProfile(client: Client, ownerId: string) {
  const existing = await client.fetchOne(
    client.query("userProfile").Where("ownerId", "=", ownerId),
  );
  if (existing) return existing;
  return client.insert("userProfile", { ownerId });
}

/** Update allowed profile fields. Ensures the row exists first. */
export async function updateProfile(client: Client, ownerId: string, patch: ProfilePatch) {
  const profile = await getProfile(client, ownerId);
  return client.update("userProfile", profile.id, (p) => {
    if (patch.displayName !== undefined) p.displayName = patch.displayName;
    if (patch.photoUrl !== undefined) p.photoUrl = patch.photoUrl;
    if (patch.heightCm !== undefined) p.heightCm = patch.heightCm;
    if (patch.currentWeightKg !== undefined) p.currentWeightKg = patch.currentWeightKg;
    if (patch.goalWeightKg !== undefined) p.goalWeightKg = patch.goalWeightKg;
    if (patch.trainingGoal !== undefined) p.trainingGoal = patch.trainingGoal;
    if (patch.unitPreference !== undefined) p.unitPreference = patch.unitPreference;
    if (patch.defaultRestSec !== undefined) p.defaultRestSec = patch.defaultRestSec;
    if (patch.defaultSets !== undefined) p.defaultSets = patch.defaultSets;
    if (patch.defaultReps !== undefined) p.defaultReps = patch.defaultReps;
  });
}

/**
 * Log a body-weight entry and mirror it onto the profile's currentWeightKg.
 * Writes a bodyWeightLogs row (history) + updates the profile (latest value).
 */
export async function logBodyWeight(
  client: Client,
  args: { ownerId: string; weightKg: number; loggedAt: number },
) {
  const log = await addBodyWeightLog(client, args);
  await updateProfile(client, args.ownerId, { currentWeightKg: args.weightKg });
  return log;
}

export interface ExerciseStatPoint {
  sessionId: string;
  date: number;
  best1rm: number;
  volume: number;
  topWeight: number;
}

/**
 * Per-session stats for one exercise across finished sessions, oldest→newest.
 * Powers the trend charts. Computed client-side (fine for one exercise).
 */
export async function exerciseStats(
  client: Client,
  exerciseId: string,
): Promise<ExerciseStatPoint[]> {
  const ses = await client.fetch(
    client.query("sessionExercises").Where("exerciseId", "=", exerciseId),
  );
  if (ses.length === 0) return [];

  const sessions = await client.fetch(client.query("sessions"));
  const byId = new Map(sessions.map((s) => [s.id, s]));

  const points: ExerciseStatPoint[] = [];
  for (const se of ses) {
    const session = byId.get(se.sessionId);
    if (!session || session.endedAt == null) continue;
    const sets = await client.fetch(
      client.query("setLogs").Where("sessionExerciseId", "=", se.id).Where("completed", "=", true),
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
 * Routines (the saved plan). Prescription tree, separate from sessions.
 * ------------------------------------------------------------------------- */

export async function createRoutine(
  client: Client,
  args: { ownerId: string; name: string; order?: number; category?: string },
) {
  return client.insert("routines", {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
    category: args.category,
  });
}

export async function renameRoutine(client: Client, id: string, name: string) {
  return client.update("routines", id, (r) => {
    r.name = name;
  });
}

/**
 * Set (or clear) a routine's free-text focus/split tag (Push, Pull, Legs…).
 * Pass `undefined`/empty to clear it — the Plans page then falls back to a
 * name-derived label.
 */
export async function setRoutineCategory(client: Client, id: string, category?: string) {
  const value = category?.trim() || undefined;
  return client.update("routines", id, (r) => {
    r.category = value;
  });
}

/**
 * Set the weekdays a routine is scheduled for (0=Sun … 6=Sat) — the
 * "today's workout" mechanism. Assigning a fresh Set overwrites the old days
 * (Triplit's update proxy clears removed members). Owner-scoped via the row.
 */
export async function setRoutineSchedule(client: Client, id: string, days: number[]) {
  const clean = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return client.update("routines", id, (r) => {
    r.scheduledDays = new Set(clean);
  });
}

/**
 * Delete a routine and everything that hangs off it. Triplit has no FK cascade,
 * so we remove children-first (same manual pattern as discardSession): each
 * routineExercise's routineSets, then the routineExercises, then the routine.
 *
 * A routine can also be referenced by program days (a program day points to a
 * routineId). Deleting the routine without touching them would leave dangling
 * refs that render as a stale routine name, so we first detach every program
 * day that points here by clearing its routineId — turning it into a Rest slot
 * while keeping the program's day/weekday structure intact (id-based, via
 * updateProgramDay).
 */
export async function deleteRoutine(client: Client, id: string) {
  // Detach referencing program days first so none point at a deleted routine.
  const refDays = await client.fetch(
    client.query("programDays").Where("routineId", "=", id),
  );
  for (const d of refDays) {
    await client.update("programDays", d.id, (day) => {
      day.routineId = undefined;
    });
  }

  // Then cascade the prescription tree (routineExercises → routineSets).
  const exs = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", id),
  );
  for (const ex of exs) {
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", ex.id),
    );
    for (const s of sets) await client.delete("routineSets", s.id);
    await client.delete("routineExercises", ex.id);
  }
  await client.delete("routines", id);
}

export async function addRoutineExercise(
  client: Client,
  args: { routineId: string; exerciseId: string; order: number; restSec?: number },
) {
  return client.insert("routineExercises", {
    ownerId: await ownerOf(client, "routines", args.routineId),
    routineId: args.routineId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec: args.restSec ?? 120,
  });
}

/**
 * Add an exercise to a routine pre-filled from the user's profile defaults:
 * `defaultSets` routineSets (each `targetReps` = `defaultReps`) and the
 * routineExercise's `restSec` = `defaultRestSec`. Falls back to 3 sets /
 * 10 reps / 120s rest when no profile defaults exist.
 */
export async function addRoutineExerciseWithDefaults(
  client: Client,
  args: { routineId: string; exerciseId: string; order: number; ownerId: string },
) {
  const profile = await getProfile(client, args.ownerId);
  const sets = profile.defaultSets ?? 3;
  const reps = profile.defaultReps ?? 10;
  const restSec = profile.defaultRestSec ?? 120;

  const re = await addRoutineExercise(client, {
    routineId: args.routineId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec,
  });
  for (let i = 0; i < sets; i++) {
    await addRoutineSet(client, {
      routineExerciseId: re.id,
      order: i + 1,
      targetReps: reps,
    });
  }
  return re;
}

export async function removeRoutineExercise(client: Client, id: string) {
  const sets = await client.fetch(
    client.query("routineSets").Where("routineExerciseId", "=", id),
  );
  for (const s of sets) await client.delete("routineSets", s.id);
  await client.delete("routineExercises", id);
}

export async function addRoutineSet(
  client: Client,
  args: {
    routineExerciseId: string;
    order: number;
    targetReps?: number;
    targetWeight?: number;
    type?: string;
  },
) {
  return client.insert("routineSets", {
    ownerId: await ownerOf(client, "routineExercises", args.routineExerciseId),
    routineExerciseId: args.routineExerciseId,
    order: args.order,
    type: args.type ?? "normal",
    targetReps: args.targetReps,
    targetWeight: args.targetWeight,
  });
}

export async function updateRoutineSet(
  client: Client,
  id: string,
  patch: { targetReps?: number; targetWeight?: number },
) {
  return client.update("routineSets", id, (s) => {
    if (patch.targetReps !== undefined) s.targetReps = patch.targetReps;
    if (patch.targetWeight !== undefined) s.targetWeight = patch.targetWeight;
  });
}

export async function deleteRoutineSet(client: Client, id: string) {
  return client.delete("routineSets", id);
}

/**
 * Start a live session from a saved routine: deep-copy the prescription tree
 * into the session tree (targets become the starting weight/reps, uncompleted).
 * This is what keeps plan and history independent.
 */
export async function startSessionFromRoutine(
  client: Client,
  args: { routineId: string; ownerId: string; now: number },
) {
  const routine = await client.fetchById("routines", args.routineId);
  const session = await client.insert("sessions", {
    ownerId: args.ownerId,
    routineId: args.routineId,
    name: routine?.name ?? "Workout",
    startedAt: args.now,
  });

  const exs = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", args.routineId).Order("order", "ASC"),
  );
  for (const ex of exs) {
    const se = await client.insert("sessionExercises", {
      ownerId: args.ownerId,
      sessionId: session.id,
      exerciseId: ex.exerciseId,
      order: ex.order,
      supersetGroup: ex.supersetGroup,
      restSec: ex.restSec,
    });
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", ex.id).Order("order", "ASC"),
    );
    for (const rs of sets) {
      await client.insert("setLogs", {
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
 * Duplicate a routine into the user's library under a fresh "(copy)" name,
 * deep-cloning its exercises + sets (incl. superset groups, rest, targets). The
 * copy is fully independent — editing it never touches the original. Returns the
 * new routine id (or null when the source is missing).
 */
export async function duplicateRoutine(
  client: Client,
  args: { routineId: string; ownerId: string },
): Promise<string | null> {
  const src = await client.fetchById("routines", args.routineId);
  if (!src) return null;

  // Unique "(copy)" name within the owner's routines.
  const existing = await client.fetch(
    client.query("routines").Where("ownerId", "=", args.ownerId),
  );
  const names = new Set(existing.map((r) => r.name));
  let name = `${src.name} (copy)`;
  for (let n = 2; names.has(name); n++) name = `${src.name} (copy ${n})`;

  const copy = await client.insert("routines", {
    ownerId: args.ownerId,
    name,
    notes: src.notes,
    order: src.order ?? 0,
    scheduledDays: src.scheduledDays ? new Set(src.scheduledDays) : undefined,
  });

  const exs = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", args.routineId).Order("order", "ASC"),
  );
  for (const ex of exs) {
    const re = await client.insert("routineExercises", {
      ownerId: args.ownerId,
      routineId: copy.id,
      exerciseId: ex.exerciseId,
      order: ex.order,
      supersetGroup: ex.supersetGroup,
      restSec: ex.restSec,
      notes: ex.notes,
    });
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", ex.id).Order("order", "ASC"),
    );
    for (const s of sets) {
      await client.insert("routineSets", {
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
 * Save-back (#3) — push a finished session's changes back into its routine.
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

/**
 * Rewrite a routine's prescription from a finished session, per mode:
 *  - "numbers"    keep the prescribed lineup; adopt the weights/reps performed.
 *  - "exercises"  adopt the performed lineup; keep prescribed numbers where the
 *                 exercise already existed (new exercises take performed numbers).
 *  - "everything" adopt lineup AND numbers exactly as performed.
 * Only the routine tree is rewritten — the session (history) is untouched.
 */
export async function applySessionToRoutine(
  client: Client,
  args: { sessionId: string; routineId: string; mode: SaveBackMode },
) {
  // Performed lineup + the loads actually logged.
  const ses = await client.fetch(
    client.query("sessionExercises").Where("sessionId", "=", args.sessionId).Order("order", "ASC"),
  );
  const performed: PlanEntry[] = [];
  for (const se of ses) {
    const sets = await client.fetch(
      client.query("setLogs").Where("sessionExerciseId", "=", se.id).Order("order", "ASC"),
    );
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

  // Current prescription (kept for "numbers"/"exercises" modes).
  const oldEx = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", args.routineId).Order("order", "ASC"),
  );
  const oldPlan: PlanEntry[] = [];
  const oldSetsByExerciseId = new Map<string, PlanEntry["sets"]>();
  for (const re of oldEx) {
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", re.id).Order("order", "ASC"),
    );
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
    if (!oldSetsByExerciseId.has(re.exerciseId)) oldSetsByExerciseId.set(re.exerciseId, entry.sets);
  }

  let plan: PlanEntry[];
  if (args.mode === "everything") {
    plan = performed;
  } else if (args.mode === "numbers") {
    const performedByExId = new Map(performed.map((p) => [p.exerciseId, p.sets]));
    plan = oldPlan.map((o) => ({ ...o, sets: performedByExId.get(o.exerciseId) ?? o.sets }));
  } else {
    // "exercises": performed lineup, keep prescribed numbers where they existed.
    plan = performed.map((p) => ({
      exerciseId: p.exerciseId,
      supersetGroup: p.supersetGroup,
      restSec: p.restSec,
      sets: oldSetsByExerciseId.get(p.exerciseId) ?? p.sets,
    }));
  }

  // Replace the routine tree.
  const ownerId = await ownerOf(client, "routines", args.routineId);
  for (const re of oldEx) {
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", re.id),
    );
    for (const s of sets) await client.delete("routineSets", s.id);
    await client.delete("routineExercises", re.id);
  }
  let order = 1;
  for (const entry of plan) {
    const re = await client.insert("routineExercises", {
      ownerId,
      routineId: args.routineId,
      exerciseId: entry.exerciseId,
      order: order++,
      supersetGroup: entry.supersetGroup,
      restSec: entry.restSec ?? 120,
    });
    let so = 1;
    for (const s of entry.sets) {
      await client.insert("routineSets", {
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
  /** Flattened plan vs performed, ready for `diffSessionVsRoutine` in @rackd/core. */
  prescription: DiffExercise[];
  performed: DiffExercise[];
  /** Set when the session's routine is a day in the user's ACTIVE program. */
  program: { programDayId: string; programName: string } | null;
}

/**
 * Gather everything the finish flow needs to offer save-back: the routine this
 * session came from, the prescription vs performed sets (for the pure diff), and
 * whether the routine belongs to the active program (enables the "here" target).
 * Returns null for ad-hoc sessions (no routineId) or a missing routine.
 */
export async function getSaveBackContext(
  client: Client,
  sessionId: string,
): Promise<SaveBackContext | null> {
  const session = await client.fetchById("sessions", sessionId);
  if (!session?.routineId) return null;
  const routine = await client.fetchById("routines", session.routineId);
  if (!routine) return null;

  const presEx = await client.fetch(
    client.query("routineExercises").Where("routineId", "=", session.routineId).Order("order", "ASC"),
  );
  const prescription: DiffExercise[] = [];
  for (const re of presEx) {
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", re.id).Order("order", "ASC"),
    );
    prescription.push({
      exerciseId: re.exerciseId,
      sets: sets.map((s) => ({ weight: s.targetWeight ?? 0, reps: s.targetReps ?? 0 })),
    });
  }

  const ses = await client.fetch(
    client.query("sessionExercises").Where("sessionId", "=", sessionId).Order("order", "ASC"),
  );
  const performed: DiffExercise[] = [];
  for (const se of ses) {
    const sets = await client.fetch(
      client.query("setLogs").Where("sessionExerciseId", "=", se.id).Order("order", "ASC"),
    );
    performed.push({
      exerciseId: se.exerciseId,
      sets: sets.map((s) => ({ weight: s.weight, reps: s.reps })),
    });
  }

  let program: SaveBackContext["program"] = null;
  const actives = await client.fetch(
    client.query("programs").Where("ownerId", "=", session.ownerId).Where("active", "=", true),
  );
  for (const pr of actives) {
    const day = await client.fetchOne(
      client
        .query("programDays")
        .Where("programId", "=", pr.id)
        .Where("routineId", "=", session.routineId),
    );
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

export async function createProgram(
  client: Client,
  args: { ownerId: string; name: string; order?: number; blockWeeks?: number },
) {
  const created = await client.insert("programs", {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
    blockWeeks: args.blockWeeks,
  });
  // First/only program becomes active by default so Home always has something to
  // drive "today". Only auto-activate when this is the SOLE program for the owner;
  // a 2nd+ program must be activated explicitly via setProgramActive (exclusive),
  // so we can never create a double-active. Single place that covers every create
  // path (Plans "+ New", template clone → createProgram). NB: a "no active program"
  // check here is racy — right after an insert the active query can momentarily
  // return empty under Triplit eventual consistency and activate without clearing.
  const all = await client.fetch(
    client.query("programs").Where("ownerId", "=", args.ownerId),
  );
  if (all.length === 1) {
    await client.update("programs", created.id, (p) => {
      p.active = true;
    });
  }
  return created;
}

export async function renameProgram(client: Client, id: string, name: string) {
  return client.update("programs", id, (p) => {
    p.name = name;
  });
}

/**
 * Mark one program as the active one (drives the dashboard "today's workout"),
 * clearing the flag on the owner's other programs. Only one active at a time.
 */
export async function setProgramActive(
  client: Client,
  args: { programId: string; ownerId: string },
) {
  const all = await client.fetch(
    client.query("programs").Where("ownerId", "=", args.ownerId),
  );
  for (const p of all) {
    const shouldBe = p.id === args.programId;
    if (!!p.active !== shouldBe) {
      await client.update("programs", p.id, (x) => {
        x.active = shouldBe;
      });
    }
  }
}

/**
 * Patch a program's schedule mode, rotation cursor, and/or block length.
 * `blockWeeks` is present-keyed (not `!== undefined`) so callers can CLEAR it by
 * passing `blockWeeks: undefined` (empty/0 in the editor = unset); a value of 0
 * is normalised to undefined.
 */
export async function setProgramSchedule(
  client: Client,
  id: string,
  patch: { scheduleMode?: "rotation" | "weekly"; rotationCursor?: number; blockWeeks?: number },
) {
  return client.update("programs", id, (p) => {
    if (patch.scheduleMode !== undefined) p.scheduleMode = patch.scheduleMode;
    if (patch.rotationCursor !== undefined) p.rotationCursor = patch.rotationCursor;
    if ("blockWeeks" in patch) p.blockWeeks = patch.blockWeeks ? patch.blockWeeks : undefined;
  });
}

export async function deleteProgram(client: Client, id: string) {
  const days = await client.fetch(client.query("programDays").Where("programId", "=", id));
  for (const d of days) await client.delete("programDays", d.id);
  await client.delete("programs", id);
}

export async function addProgramDay(
  client: Client,
  args: {
    programId: string;
    order: number;
    name?: string;
    routineId?: string;
    weekday?: number;
  },
) {
  return client.insert("programDays", {
    ownerId: await ownerOf(client, "programs", args.programId),
    programId: args.programId,
    order: args.order,
    name: args.name ?? `Day ${args.order}`,
    routineId: args.routineId,
    weekday: args.weekday,
  });
}

export async function updateProgramDay(
  client: Client,
  id: string,
  patch: { name?: string; routineId?: string; weekday?: number },
) {
  return client.update("programDays", id, (d) => {
    if (patch.name !== undefined) d.name = patch.name;
    // `"routineId" in patch` (not `!== undefined`) so callers can CLEAR the
    // assignment — turning the day into a Rest slot — by passing
    // `routineId: undefined`. An absent key leaves the routine untouched.
    if ("routineId" in patch) d.routineId = patch.routineId;
    if (patch.weekday !== undefined) d.weekday = patch.weekday;
  });
}

export async function removeProgramDay(client: Client, id: string) {
  return client.delete("programDays", id);
}

/** Persist a full reorder: `order` becomes the 1-based position in `orderedIds`. */
export async function reorderProgramDays(client: Client, orderedIds: string[]) {
  await Promise.all(
    orderedIds.map((id, i) =>
      client.update("programDays", id, (d) => {
        d.order = i + 1;
      }),
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
export async function publishRoutine(
  client: Client,
  args: { routineId: string; ownerId: string; authorName: string; now: number },
) {
  const routine = await client.fetchById("routines", args.routineId);
  if (!routine) return null;

  const exs = await client.fetch(
    client
      .query("routineExercises")
      .Where("routineId", "=", args.routineId)
      .Include("exercise")
      .Order("order", "ASC"),
  );
  const snapshot: SharedSnapshotExercise[] = [];
  for (const ex of exs) {
    const sets = await client.fetch(
      client.query("routineSets").Where("routineExerciseId", "=", ex.id).Order("order", "ASC"),
    );
    snapshot.push({
      exerciseId: ex.exerciseId,
      name: (ex as { exercise?: { name?: string } }).exercise?.name ?? "Exercise",
      sets: sets.map((s) => ({ reps: s.targetReps ?? 0, weight: s.targetWeight ?? 0 })),
    });
  }

  return client.insert("sharedRoutines", {
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
export async function cloneSharedRoutine(
  client: Client,
  args: { shared: SharedRoutineRow; ownerId: string },
): Promise<string> {
  const snapshot = JSON.parse(args.shared.exercisesJson) as SharedSnapshotExercise[];
  const routine = await createRoutine(client, { ownerId: args.ownerId, name: args.shared.name });
  for (let i = 0; i < snapshot.length; i++) {
    const ex = snapshot[i]!;
    const re = await addRoutineExercise(client, {
      routineId: routine.id,
      exerciseId: ex.exerciseId,
      order: i + 1,
    });
    for (let s = 0; s < ex.sets.length; s++) {
      const set = ex.sets[s]!;
      await addRoutineSet(client, {
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

/**
 * Last completed performance of an exercise in a prior finished session.
 * Powers the "prev" column + auto-fill. One-shot fetch (not reactive).
 */
export async function lastPerformance(
  client: Client,
  args: { exerciseId: string; excludeSessionId?: string },
): Promise<PrevSet[] | null> {
  const seRows = await client.fetch(
    client.query("sessionExercises").Where("exerciseId", "=", args.exerciseId),
  );
  if (seRows.length === 0) return null;

  const sessions = await client.fetch(client.query("sessions"));
  const startedById = new Map(sessions.map((s) => [s.id, s]));

  // most-recent prior session that actually has this exercise and is finished
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

  const sets = await client.fetch(
    client
      .query("setLogs")
      .Where("sessionExerciseId", "=", best.se.id)
      .Where("completed", "=", true)
      .Order("order", "ASC"),
  );
  if (sets.length === 0) return null;
  return sets.map((s) => ({ order: s.order, weight: s.weight, reps: s.reps }));
}

/**
 * Discard a session entirely: cascade-delete its setLogs and sessionExercises,
 * then the session row itself, so no orphans remain. Triplit has no FK cascade,
 * so we delete children-first (same manual pattern as deleteRoutine /
 * removeSessionExercise). Irreversible — the workout and everything logged in
 * it are gone (used to abandon an in-progress workout, endedAt still null).
 */
export async function discardSession(client: Client, sessionId: string) {
  const exs = await client.fetch(
    client.query("sessionExercises").Where("sessionId", "=", sessionId),
  );
  for (const ex of exs) {
    const sets = await client.fetch(
      client.query("setLogs").Where("sessionExerciseId", "=", ex.id),
    );
    for (const s of sets) await client.delete("setLogs", s.id);
    await client.delete("sessionExercises", ex.id);
  }
  await client.delete("sessions", sessionId);
}

/* ---------------------------------------------------------------------------
 * Web Push — device subscriptions + the scheduled-push queue that the
 * server-side sender (apps/push) drains. Background notifications need this:
 * a backgrounded PWA's JS is suspended, so the rest-over alert must be sent
 * server-side at the timer's endAt. UI/worker go through these, never the
 * client directly.
 * ------------------------------------------------------------------------- */

/**
 * Store (or refresh) a device's push subscription, deduped by `endpoint`.
 * Endpoints are globally unique per subscription, so a repeat call updates the
 * existing row's keys rather than piling up duplicates. Returns the row.
 */
export async function savePushSubscription(
  client: Client,
  args: {
    ownerId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
    now: number;
  },
) {
  const existing = await client.fetchOne(
    client.query("pushSubscriptions").Where("endpoint", "=", args.endpoint),
  );
  if (existing) {
    await client.update("pushSubscriptions", existing.id, (s) => {
      s.ownerId = args.ownerId;
      s.p256dh = args.p256dh;
      s.auth = args.auth;
      if (args.userAgent !== undefined) s.userAgent = args.userAgent;
    });
    return existing;
  }
  return client.insert("pushSubscriptions", {
    ownerId: args.ownerId,
    endpoint: args.endpoint,
    p256dh: args.p256dh,
    auth: args.auth,
    userAgent: args.userAgent,
    createdAt: args.now,
  });
}

/** All push subscriptions (devices) for a user. */
export async function getPushSubscriptions(client: Client, ownerId: string) {
  return client.fetch(
    client.query("pushSubscriptions").Where("ownerId", "=", ownerId),
  );
}

/** Remove a stored subscription (e.g. the push service reported it expired). */
export async function deletePushSubscription(client: Client, id: string) {
  return client.delete("pushSubscriptions", id);
}

/** Queue a push for `fireAt`. Returns the row so the caller can reschedule/cancel it. */
export async function schedulePush(
  client: Client,
  args: {
    ownerId: string;
    subscriptionId: string;
    fireAt: number;
    title: string;
    body: string;
    now: number;
  },
) {
  return client.insert("scheduledPushes", {
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
export async function reschedulePush(client: Client, id: string, fireAt: number) {
  return client.update("scheduledPushes", id, (p) => {
    if (p.status === "pending") p.fireAt = fireAt;
  });
}

/** Cancel a scheduled push (rest skipped, or fired locally in the foreground). */
export async function cancelScheduledPush(client: Client, id: string) {
  return client.delete("scheduledPushes", id);
}

/** A pending scheduled push with its target subscription resolved (Included). */
export interface PendingPushRow extends ScheduledPush {
  subscription: PushSubscriptionRecord | null;
}

/**
 * Live-subscribe to every pending push (across all owners), with each row's
 * target `subscription` Included so the sender has endpoint+keys in one read.
 * The set stays fresh as the client reschedules (fireAt changes), cancels (row
 * removed) or fires locally; the sender decides *when* to deliver by comparing
 * `fireAt` to the wall clock. Server-side only — call with a service-token
 * client so permissions are bypassed. Returns an unsubscribe fn.
 */
export function subscribePendingPushes(
  client: Client,
  onResults: (rows: PendingPushRow[]) => void,
  onError?: (error: unknown) => void,
): () => void {
  return client.subscribe(
    client.query("scheduledPushes").Where("status", "=", "pending").Include("subscription"),
    (results) => onResults(results as unknown as PendingPushRow[]),
    onError,
  );
}

/** Mark a scheduled push delivered so the sender never sends it twice. */
export async function markPushSent(client: Client, id: string) {
  return client.update("scheduledPushes", id, (p) => {
    p.status = "sent";
  });
}
