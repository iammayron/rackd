import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSession,
  addSessionExercise,
  logSet,
} from "../src/index";

/**
 * Tree-building helpers for repo tests, so a test reads as intent ("a routine
 * with two exercises") not boilerplate. All go through the real repo functions
 * (owner derivation included), against the truncated-per-test DB.
 */

export const OWNER_A = "owner-a";
export const OWNER_B = "owner-b";

/** A routine with N exercises, each with `setsPer` prescribed sets. Returns ids. */
export async function makeRoutine(opts: {
  ownerId?: string;
  name?: string;
  exerciseIds?: string[];
  setsPer?: number;
  targetReps?: number;
  targetWeight?: number;
}) {
  const ownerId = opts.ownerId ?? OWNER_A;
  const exerciseIds = opts.exerciseIds ?? ["ex_bench"];
  const setsPer = opts.setsPer ?? 2;
  const routine = await createRoutine({ ownerId, name: opts.name ?? "Routine" });
  const exercises: { id: string; exerciseId: string; setIds: string[] }[] = [];
  let order = 1;
  for (const exerciseId of exerciseIds) {
    const re = await addRoutineExercise({ routineId: routine.id, exerciseId, order: order++ });
    const setIds: string[] = [];
    for (let i = 0; i < setsPer; i++) {
      const rs = await addRoutineSet({
        routineExerciseId: re.id,
        order: i + 1,
        targetReps: opts.targetReps ?? 5,
        targetWeight: opts.targetWeight,
      });
      setIds.push(rs.id);
    }
    exercises.push({ id: re.id, exerciseId, setIds });
  }
  return { routineId: routine.id, ownerId, exercises };
}

/** A session with one exercise and a list of completed logged sets. Returns ids. */
export async function makeSessionWithSets(opts: {
  ownerId?: string;
  routineId?: string;
  exerciseId?: string;
  sets: { weight: number; reps: number; rpe?: number }[];
}) {
  const ownerId = opts.ownerId ?? OWNER_A;
  const exerciseId = opts.exerciseId ?? "ex_bench";
  const session = await startSession({ ownerId, routineId: opts.routineId, name: "W", now: Date.now() });
  const se = await addSessionExercise({ sessionId: session.id, exerciseId, order: 1 });
  const setIds: string[] = [];
  let order = 1;
  for (const s of opts.sets) {
    const log = await logSet({
      sessionExerciseId: se.id,
      order: order++,
      weight: s.weight,
      reps: s.reps,
      rpe: s.rpe,
    });
    setIds.push(log.id);
  }
  return { sessionId: session.id, sessionExerciseId: se.id, ownerId, exerciseId, setIds };
}
