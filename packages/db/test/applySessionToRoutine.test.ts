import { describe, it, expect } from "vitest";
import { eq, asc } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  applySessionToRoutine,
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSession,
  addSessionExercise,
  logSet,
} from "../src/index";
import { OWNER_A } from "./factories";

/** Read a routine's prescription tree: exercises (ordered) each with their sets (ordered). */
async function readRoutineTree(routineId: string) {
  const exs = await db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, routineId))
    .orderBy(asc(t.routineExercises.order));
  const out: Array<{
    exerciseId: string;
    sets: Array<{ targetWeight: number | null; targetReps: number | null }>;
  }> = [];
  for (const re of exs) {
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, re.id))
      .orderBy(asc(t.routineSets.order));
    out.push({
      exerciseId: re.exerciseId,
      sets: sets.map((s) => ({ targetWeight: s.targetWeight, targetReps: s.targetReps })),
    });
  }
  return out;
}

/** Count all routineSets currently under a routine (via its exercises). */
async function countRoutineSets(routineId: string) {
  const exs = await db
    .select({ id: t.routineExercises.id })
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, routineId));
  let total = 0;
  for (const re of exs) {
    const sets = await db
      .select()
      .from(t.routineSets)
      .where(eq(t.routineSets.routineExerciseId, re.id));
    total += sets.length;
  }
  return total;
}

/** Build a routine from a compact prescription spec. */
async function buildRoutine(
  spec: Array<{ exerciseId: string; sets: Array<{ reps?: number; weight?: number }> }>,
) {
  const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
  let order = 1;
  for (const e of spec) {
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: e.exerciseId,
      order: order++,
    });
    let so = 1;
    for (const s of e.sets) {
      await addRoutineSet({
        routineExerciseId: re.id,
        order: so++,
        targetReps: s.reps,
        targetWeight: s.weight,
      });
    }
  }
  return routine.id;
}

/** Build a finished session from a compact performed spec (all sets completed). */
async function buildSession(
  spec: Array<{ exerciseId: string; sets: Array<{ weight: number; reps: number }> }>,
) {
  const session = await startSession({ ownerId: OWNER_A, name: "W", now: Date.now() });
  let order = 1;
  for (const e of spec) {
    const se = await addSessionExercise({
      sessionId: session.id,
      exerciseId: e.exerciseId,
      order: order++,
    });
    let so = 1;
    for (const s of e.sets) {
      await logSet({ sessionExerciseId: se.id, order: so++, weight: s.weight, reps: s.reps });
    }
  }
  return session.id;
}

describe("applySessionToRoutine (real Postgres)", () => {
  describe('mode "everything"', () => {
    it("makes the routine become exactly the performed session (lineup + numbers)", async () => {
      const routineId = await buildRoutine([
        { exerciseId: "ex_bench", sets: [{ reps: 5, weight: 60 }] },
      ]);
      const sessionId = await buildSession([
        {
          exerciseId: "ex_squat",
          sets: [
            { weight: 100, reps: 5 },
            { weight: 105, reps: 3 },
          ],
        },
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 8 }] },
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "everything" });

      expect(await readRoutineTree(routineId)).toEqual([
        {
          exerciseId: "ex_squat",
          sets: [
            { targetWeight: 100, targetReps: 5 },
            { targetWeight: 105, targetReps: 3 },
          ],
        },
        { exerciseId: "ex_bench", sets: [{ targetWeight: 80, targetReps: 8 }] },
      ]);
    });

    it("preserves performed order", async () => {
      const routineId = await buildRoutine([{ exerciseId: "ex_bench", sets: [{ reps: 5 }] }]);
      const sessionId = await buildSession([
        { exerciseId: "ex_row", sets: [{ weight: 50, reps: 10 }] },
        { exerciseId: "ex_squat", sets: [{ weight: 100, reps: 5 }] },
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 5 }] },
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "everything" });
      const tree = await readRoutineTree(routineId);
      expect(tree.map((e) => e.exerciseId)).toEqual(["ex_row", "ex_squat", "ex_bench"]);
    });
  });

  describe('mode "numbers"', () => {
    it("keeps the OLD lineup/order, overlaying performed weights/reps by exerciseId", async () => {
      const routineId = await buildRoutine([
        { exerciseId: "ex_squat", sets: [{ reps: 5, weight: 90 }] },
        { exerciseId: "ex_bench", sets: [{ reps: 5, weight: 60 }] },
      ]);
      // Session performed in a different order, with different numbers.
      const sessionId = await buildSession([
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 8 }] },
        { exerciseId: "ex_squat", sets: [{ weight: 100, reps: 5 }] },
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "numbers" });

      // Lineup/order stays squat-then-bench; numbers come from the session.
      expect(await readRoutineTree(routineId)).toEqual([
        { exerciseId: "ex_squat", sets: [{ targetWeight: 100, targetReps: 5 }] },
        { exerciseId: "ex_bench", sets: [{ targetWeight: 80, targetReps: 8 }] },
      ]);
    });

    it("keeps old sets for a routine exercise that was not performed", async () => {
      const routineId = await buildRoutine([
        { exerciseId: "ex_bench", sets: [{ reps: 5, weight: 60 }] },
        {
          exerciseId: "ex_row",
          sets: [
            { reps: 10, weight: 40 },
            { reps: 10, weight: 40 },
          ],
        },
      ]);
      // Only bench performed; row absent from the session.
      const sessionId = await buildSession([
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 8 }] },
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "numbers" });

      expect(await readRoutineTree(routineId)).toEqual([
        { exerciseId: "ex_bench", sets: [{ targetWeight: 80, targetReps: 8 }] },
        {
          exerciseId: "ex_row",
          sets: [
            { targetWeight: 40, targetReps: 10 },
            { targetWeight: 40, targetReps: 10 },
          ],
        },
      ]);
    });

    it("does not add session exercises absent from the routine", async () => {
      const routineId = await buildRoutine([
        { exerciseId: "ex_bench", sets: [{ reps: 5, weight: 60 }] },
      ]);
      const sessionId = await buildSession([
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 8 }] },
        { exerciseId: "ex_squat", sets: [{ weight: 100, reps: 5 }] }, // not in routine
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "numbers" });

      const tree = await readRoutineTree(routineId);
      expect(tree.map((e) => e.exerciseId)).toEqual(["ex_bench"]);
    });
  });

  describe('mode "exercises"', () => {
    it("adopts the performed lineup but keeps old prescribed sets where the exercise already existed", async () => {
      const routineId = await buildRoutine([
        {
          exerciseId: "ex_bench",
          sets: [
            { reps: 5, weight: 60 },
            { reps: 5, weight: 60 },
          ],
        },
      ]);
      // Performed: squat (new) then bench (existing, with new heavier numbers).
      const sessionId = await buildSession([
        { exerciseId: "ex_squat", sets: [{ weight: 140, reps: 5 }] },
        { exerciseId: "ex_bench", sets: [{ weight: 80, reps: 8 }] },
      ]);

      await applySessionToRoutine({ sessionId, routineId, mode: "exercises" });

      expect(await readRoutineTree(routineId)).toEqual([
        // new exercise -> takes performed numbers
        { exerciseId: "ex_squat", sets: [{ targetWeight: 140, targetReps: 5 }] },
        // existing exercise -> keeps the OLD prescribed sets (2 x 60x5), not the performed 80x8
        {
          exerciseId: "ex_bench",
          sets: [
            { targetWeight: 60, targetReps: 5 },
            { targetWeight: 60, targetReps: 5 },
          ],
        },
      ]);
    });
  });

  it("coerces a logged weight of 0 to a null targetWeight (s.weight || undefined)", async () => {
    const routineId = await buildRoutine([
      { exerciseId: "ex_bench", sets: [{ reps: 5, weight: 60 }] },
    ]);
    // Bodyweight-style set: 0 kg x 12.
    const sessionId = await buildSession([
      { exerciseId: "ex_bench", sets: [{ weight: 0, reps: 12 }] },
    ]);

    await applySessionToRoutine({ sessionId, routineId, mode: "everything" });

    const tree = await readRoutineTree(routineId);
    expect(tree[0]!.exerciseId).toBe("ex_bench");
    expect(tree[0]!.sets[0]!.targetWeight).toBeNull();
    expect(tree[0]!.sets[0]!.targetReps).toBe(12);
  });

  it("fully replaces the old routineExercises/routineSets subtree (no orphan rows left)", async () => {
    const routineId = await buildRoutine([
      { exerciseId: "ex_bench", sets: [{ reps: 5 }, { reps: 5 }, { reps: 5 }] },
      { exerciseId: "ex_row", sets: [{ reps: 10 }, { reps: 10 }] },
    ]);
    expect(await countRoutineSets(routineId)).toBe(5);

    const oldExIds = (
      await db
        .select({ id: t.routineExercises.id })
        .from(t.routineExercises)
        .where(eq(t.routineExercises.routineId, routineId))
    ).map((r) => r.id);

    const sessionId = await buildSession([
      { exerciseId: "ex_squat", sets: [{ weight: 100, reps: 5 }] },
    ]);

    await applySessionToRoutine({ sessionId, routineId, mode: "everything" });

    // New subtree = 1 exercise, 1 set.
    expect(await countRoutineSets(routineId)).toBe(1);
    const tree = await readRoutineTree(routineId);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.exerciseId).toBe("ex_squat");

    // Old routineExercise rows are gone, and so are their sets (no dangling orphans).
    for (const oldId of oldExIds) {
      const stillThere = await db
        .select()
        .from(t.routineExercises)
        .where(eq(t.routineExercises.id, oldId));
      expect(stillThere).toHaveLength(0);
      const orphanSets = await db
        .select()
        .from(t.routineSets)
        .where(eq(t.routineSets.routineExerciseId, oldId));
      expect(orphanSets).toHaveLength(0);
    }
  });
});
