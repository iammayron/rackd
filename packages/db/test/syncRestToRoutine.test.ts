import { describe, it, expect } from "vitest";
import { eq, asc } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  createRoutine,
  addRoutineExercise,
  updateRoutineExercise,
  startSessionFromRoutine,
  startSession,
  addSessionExercise,
  updateSessionExercise,
  finishSession,
} from "../src/index";
import { OWNER_A } from "./factories";

/**
 * `syncRestToRoutine` is internal; we drive it through `finishSession`, which
 * calls it. It carries per-exercise restSec edits made during a live workout
 * back onto the source routine for the next run.
 */

const routineExercises = (routineId: string) =>
  db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, routineId))
    .orderBy(asc(t.routineExercises.order));

const sessionExercises = (sessionId: string) =>
  db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, sessionId))
    .orderBy(asc(t.sessionExercises.order));

describe("syncRestToRoutine (via finishSession)", () => {
  it("writes a single matched exercise's restSec back to the routine", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    await updateRoutineExercise(re.id, { restSec: 120 });

    const session = await startSessionFromRoutine({
      routineId: routine.id,
      ownerId: OWNER_A,
      now: 1000,
    });
    const [se] = await sessionExercises(session.id);
    await updateSessionExercise(se!.id, { restSec: 45 });

    await finishSession(session.id, 2000);

    const [updated] = await routineExercises(routine.id);
    expect(updated!.restSec).toBe(45);
  });

  it("pairs duplicate routine slots by order so the edited slot updates", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    // Two bench slots with distinct rest values.
    const first = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    const second = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 2,
    });
    await updateRoutineExercise(first.id, { restSec: 60 });
    await updateRoutineExercise(second.id, { restSec: 90 });

    const session = await startSessionFromRoutine({
      routineId: routine.id,
      ownerId: OWNER_A,
      now: 1000,
    });
    const ses = await sessionExercises(session.id);
    // Edit only the second (order 2) session exercise.
    await updateSessionExercise(ses[1]!.id, { restSec: 200 });

    await finishSession(session.id, 2000);

    const res = await routineExercises(routine.id);
    // First slot (order 1) unchanged; second slot (order 2) gets the edit.
    expect(res[0]!.restSec).toBe(60);
    expect(res[1]!.restSec).toBe(200);
  });

  it("does not write when rest is unchanged", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    await updateRoutineExercise(re.id, { restSec: 120 });

    const session = await startSessionFromRoutine({
      routineId: routine.id,
      ownerId: OWNER_A,
      now: 1000,
    });
    // No edit to the session exercise; rest stays 120 on both sides.

    await finishSession(session.id, 2000);

    const [unchanged] = await routineExercises(routine.id);
    expect(unchanged!.restSec).toBe(120);
  });

  it("is a no-op for an ad-hoc session with no routineId", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    await updateRoutineExercise(re.id, { restSec: 120 });

    // Ad-hoc session: not started from the routine, no routineId link.
    const session = await startSession({ ownerId: OWNER_A, name: "Ad-hoc", now: 1000 });
    const se = await addSessionExercise({
      sessionId: session.id,
      exerciseId: "ex_bench",
      order: 1,
      restSec: 30,
    });
    await updateSessionExercise(se.id, { restSec: 30 });

    await finishSession(session.id, 2000);

    // The unrelated routine is untouched.
    const [untouched] = await routineExercises(routine.id);
    expect(untouched!.restSec).toBe(120);
  });
});
