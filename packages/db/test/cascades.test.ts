import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  deleteRoutine,
  discardSession,
  removeSessionExercise,
  removeRoutineExercise,
  addProgramDay,
  createProgram,
} from "../src/index";
import { makeRoutine, makeSessionWithSets, OWNER_A } from "./factories";

const count = async (table: typeof t.routineSets, col: typeof t.routineSets.id, val: string) =>
  (await db.select().from(table).where(eq(col, val))).length;

describe("FK cascade / SET NULL behavior (real Postgres)", () => {
  it("deleteRoutine cascades exercises→sets and SET NULLs referencing rows", async () => {
    const { routineId, exercises } = await makeRoutine({ setsPer: 2, exerciseIds: ["ex_bench", "ex_squat"] });
    // A finished history session that came from this routine.
    const { sessionId } = await makeSessionWithSets({ routineId, sets: [{ weight: 100, reps: 5 }] });
    // A program day pinned to this routine.
    const program = await createProgram({ ownerId: OWNER_A, name: "P" });
    const day = await addProgramDay({ programId: program.id, order: 1, routineId });

    await deleteRoutine(routineId);

    // routine + its exercise/set subtree gone
    expect(await count(t.routines, t.routines.id, routineId)).toBe(0);
    expect(await count(t.routineExercises, t.routineExercises.routineId, routineId)).toBe(0);
    expect(await count(t.routineSets, t.routineSets.id, exercises[0]!.setIds[0]!)).toBe(0);
    // history session survives but its routineId is nulled
    const [session] = await db.select().from(t.sessions).where(eq(t.sessions.id, sessionId));
    expect(session).toBeDefined();
    expect(session!.routineId).toBeNull();
    // program day survives but detached
    const [pd] = await db.select().from(t.programDays).where(eq(t.programDays.id, day.id));
    expect(pd!.routineId).toBeNull();
  });

  it("discardSession cascades sessionExercises→setLogs", async () => {
    const { sessionId, sessionExerciseId, setIds } = await makeSessionWithSets({
      sets: [{ weight: 100, reps: 5 }, { weight: 105, reps: 3 }],
    });
    await discardSession(sessionId);
    expect(await count(t.sessions, t.sessions.id, sessionId)).toBe(0);
    expect(await count(t.sessionExercises, t.sessionExercises.id, sessionExerciseId)).toBe(0);
    expect(await count(t.setLogs, t.setLogs.id, setIds[0]!)).toBe(0);
  });

  it("removeSessionExercise cascades its setLogs only", async () => {
    const { sessionId, sessionExerciseId, setIds } = await makeSessionWithSets({
      sets: [{ weight: 100, reps: 5 }],
    });
    await removeSessionExercise(sessionExerciseId);
    expect(await count(t.setLogs, t.setLogs.id, setIds[0]!)).toBe(0);
    // session itself untouched
    expect(await count(t.sessions, t.sessions.id, sessionId)).toBe(1);
  });

  it("removeRoutineExercise cascades its routineSets only", async () => {
    const { routineId, exercises } = await makeRoutine({ setsPer: 3 });
    await removeRoutineExercise(exercises[0]!.id);
    expect(await count(t.routineSets, t.routineSets.id, exercises[0]!.setIds[0]!)).toBe(0);
    expect(await count(t.routines, t.routines.id, routineId)).toBe(1);
  });
});
