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
