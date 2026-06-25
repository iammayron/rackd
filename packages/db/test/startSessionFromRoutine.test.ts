import { describe, it, expect } from "vitest";
import { eq, asc } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  setRoutineExerciseSuperset,
  updateRoutineExercise,
  startSessionFromRoutine,
} from "../src/index";
import { makeRoutine, OWNER_A } from "./factories";

const sessionExercises = (sessionId: string) =>
  db
    .select()
    .from(t.sessionExercises)
    .where(eq(t.sessionExercises.sessionId, sessionId))
    .orderBy(asc(t.sessionExercises.order));

const setLogs = (sessionExerciseId: string) =>
  db
    .select()
    .from(t.setLogs)
    .where(eq(t.setLogs.sessionExerciseId, sessionExerciseId))
    .orderBy(asc(t.setLogs.order));

describe("startSessionFromRoutine (deep-copy plan → live session)", () => {
  it("preserves exercise order from the routine", async () => {
    const { routineId } = await makeRoutine({
      exerciseIds: ["ex_squat", "ex_bench", "ex_row"],
      setsPer: 1,
    });

    const session = await startSessionFromRoutine({ routineId, ownerId: OWNER_A, now: 1000 });

    const ses = await sessionExercises(session.id);
    expect(ses.map((s) => s.exerciseId)).toEqual(["ex_squat", "ex_bench", "ex_row"]);
    expect(ses.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it("carries supersetGroup and restSec onto session exercises", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
    await setRoutineExerciseSuperset(re.id, 7);
    await updateRoutineExercise(re.id, { restSec: 90 });

    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });

    const [se] = await sessionExercises(session.id);
    expect(se!.supersetGroup).toBe(7);
    expect(se!.restSec).toBe(90);
  });

  it("copies routineSets to setLogs with targets, completed=false", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
    await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 100 });
    await addRoutineSet({ routineExerciseId: re.id, order: 2, targetReps: 8, targetWeight: 80 });

    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });

    const [se] = await sessionExercises(session.id);
    const logs = await setLogs(se!.id);
    expect(logs).toHaveLength(2);
    expect(logs.map((l) => [l.weight, l.reps, l.completed])).toEqual([
      [100, 5, false],
      [80, 8, false],
    ]);
  });

  it("defaults weight/reps to 0 when targets are null", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "R" });
    const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
    // No targetReps / targetWeight => both null on the routine set.
    await addRoutineSet({ routineExerciseId: re.id, order: 1 });

    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });

    const [se] = await sessionExercises(session.id);
    const logs = await setLogs(se!.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]!.weight).toBe(0);
    expect(logs[0]!.reps).toBe(0);
  });

  it("empty routine yields a session with no exercises", async () => {
    const routine = await createRoutine({ ownerId: OWNER_A, name: "Empty" });

    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });

    expect(session.name).toBe("Empty");
    expect(session.routineId).toBe(routine.id);
    expect(await sessionExercises(session.id)).toHaveLength(0);
  });

  it("a non-existent routineId is rejected by the FK (no dangling session)", async () => {
    // sessions.routineId FK-references routines, so starting from a missing
    // routine throws rather than creating an orphaned session.
    await expect(
      startSessionFromRoutine({ routineId: "does-not-exist", ownerId: OWNER_A, now: 1000 }),
    ).rejects.toThrow();
  });
});
