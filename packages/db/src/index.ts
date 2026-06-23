import { TriplitClient } from "@triplit/client";
import { estimate1RM } from "@fitnow/core";
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
        ? { type: "indexeddb", name: opts?.dbName ?? "fitnow" }
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

export async function setRoutineExerciseOrder(client: Client, id: string, order: number) {
  return client.update("routineExercises", id, (e) => {
    e.order = order;
  });
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
    if (patch.rpe !== undefined) s.rpe = patch.rpe;
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
    return detectAndRecordPRs(client, { sessionId, ownerId: session.ownerId, now });
  }
  return [];
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
  args: { ownerId: string; name: string; order?: number },
) {
  return client.insert("routines", {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
  });
}

export async function renameRoutine(client: Client, id: string, name: string) {
  return client.update("routines", id, (r) => {
    r.name = name;
  });
}

export async function deleteRoutine(client: Client, id: string) {
  // remove children first (no cascade)
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

/* ---------------------------------------------------------------------------
 * Programs (ordered named days, each mapped to a routine)
 * ------------------------------------------------------------------------- */

export async function createProgram(
  client: Client,
  args: { ownerId: string; name: string; order?: number },
) {
  return client.insert("programs", {
    ownerId: args.ownerId,
    name: args.name,
    order: args.order ?? 0,
  });
}

export async function renameProgram(client: Client, id: string, name: string) {
  return client.update("programs", id, (p) => {
    p.name = name;
  });
}

export async function deleteProgram(client: Client, id: string) {
  const days = await client.fetch(client.query("programDays").Where("programId", "=", id));
  for (const d of days) await client.delete("programDays", d.id);
  await client.delete("programs", id);
}

export async function addProgramDay(
  client: Client,
  args: { programId: string; order: number; name?: string; routineId?: string },
) {
  return client.insert("programDays", {
    ownerId: await ownerOf(client, "programs", args.programId),
    programId: args.programId,
    order: args.order,
    name: args.name ?? `Day ${args.order}`,
    routineId: args.routineId,
  });
}

export async function updateProgramDay(
  client: Client,
  id: string,
  patch: { name?: string; routineId?: string },
) {
  return client.update("programDays", id, (d) => {
    if (patch.name !== undefined) d.name = patch.name;
    if (patch.routineId !== undefined) d.routineId = patch.routineId;
  });
}

export async function removeProgramDay(client: Client, id: string) {
  return client.delete("programDays", id);
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
