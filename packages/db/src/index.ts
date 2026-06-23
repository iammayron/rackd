import { TriplitClient } from "@triplit/client";
import { schema } from "./schema";

export { schema } from "./schema";
export type { Schema } from "./schema";
export { SEED_EXERCISES, seedExercises } from "./seed";
export type { SeedExercise } from "./seed";

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
    serverUrl: opts?.serverUrl,
    token: opts?.token,
    storage:
      opts?.storage === "indexeddb"
        ? { type: "indexeddb", name: opts?.dbName ?? "fitnow" }
        : opts?.storage,
    autoConnect: Boolean(opts?.serverUrl),
  });
}

export type Client = ReturnType<typeof createClient>;

/**
 * Repository layer — one command function per intent. UI calls these,
 * not the client. Keeps mutations in one place and the engine swappable.
 */

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
    sessionId: args.sessionId,
    exerciseId: args.exerciseId,
    order: args.order,
    restSec: args.restSec ?? 120,
  });
}

/** Add an empty (uncompleted) set row to a session exercise. */
export async function addSet(
  client: Client,
  args: { sessionExerciseId: string; order: number; type?: string; weight?: number; reps?: number },
) {
  return client.insert("setLogs", {
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
  return client.update("sessions", sessionId, (s) => {
    s.endedAt = now;
  });
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
