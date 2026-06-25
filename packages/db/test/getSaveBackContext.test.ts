import { describe, it, expect } from "vitest";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSessionFromRoutine,
  startSession,
  addSessionExercise,
  logSet,
  deleteRoutine,
  createProgram,
  addProgramDay,
  setProgramActive,
  getSaveBackContext,
} from "../src/index";
import { OWNER_A } from "./factories";

/** Build a routine with one bench exercise + two prescribed sets. */
async function benchRoutine() {
  const routine = await createRoutine({ ownerId: OWNER_A, name: "Bench Day" });
  const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
  await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 100 });
  await addRoutineSet({ routineExerciseId: re.id, order: 2, targetReps: 5, targetWeight: 100 });
  return routine;
}

describe("getSaveBackContext", () => {
  it("returns null when the session has no routineId", async () => {
    const session = await startSession({ ownerId: OWNER_A, name: "Ad-hoc", now: 1000 });
    expect(await getSaveBackContext(session.id)).toBeNull();
  });

  it("returns null when the source routine was deleted", async () => {
    const routine = await benchRoutine();
    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });
    await deleteRoutine(routine.id); // session.routineId is SET NULL by the FK
    expect(await getSaveBackContext(session.id)).toBeNull();
  });

  it("returns prescription and performed DiffExercise shapes", async () => {
    const routine = await benchRoutine();
    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });
    // Re-perform with different numbers via a manual session exercise + logs.
    const se = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_squat", order: 2 });
    await logSet({ sessionExerciseId: se.id, order: 1, weight: 140, reps: 3 });

    const ctx = await getSaveBackContext(session.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.routineId).toBe(routine.id);
    expect(ctx!.routineName).toBe("Bench Day");
    // Prescription mirrors the routine: one bench exercise, two sets at 100x5.
    expect(ctx!.prescription).toEqual([
      { exerciseId: "ex_bench", sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
    ]);
    // Performed: the copied bench (two sets at 100x5, uncompleted but still logged
    // values) followed by the ad-hoc squat set.
    expect(ctx!.performed).toEqual([
      { exerciseId: "ex_bench", sets: [{ weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
      { exerciseId: "ex_squat", sets: [{ weight: 140, reps: 3 }] },
    ]);
  });

  it("populates program when the routine is a day in the owner's active program", async () => {
    const routine = await benchRoutine();
    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });
    const program = await createProgram({ ownerId: OWNER_A, name: "PPL" }); // first => auto-active
    const day = await addProgramDay({ programId: program.id, order: 1, routineId: routine.id });

    const ctx = await getSaveBackContext(session.id);
    expect(ctx!.program).toEqual({ programDayId: day.id, programName: "PPL" });
  });

  it("returns null program when the matching program is inactive", async () => {
    const routine = await benchRoutine();
    const session = await startSessionFromRoutine({ routineId: routine.id, ownerId: OWNER_A, now: 1000 });
    // First program (auto-active) maps the routine; a second program is made
    // active instead, deactivating the first.
    const programA = await createProgram({ ownerId: OWNER_A, name: "Block A" });
    await addProgramDay({ programId: programA.id, order: 1, routineId: routine.id });
    const programB = await createProgram({ ownerId: OWNER_A, name: "Block B" });
    await setProgramActive({ programId: programB.id, ownerId: OWNER_A });

    const ctx = await getSaveBackContext(session.id);
    expect(ctx!.program).toBeNull();
  });
});
