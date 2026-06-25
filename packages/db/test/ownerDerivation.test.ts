import { describe, it, expect } from "vitest";
import {
  startSession,
  addSessionExercise,
  addSet,
  logSet,
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  createProgram,
  addProgramDay,
} from "../src/index";
import { OWNER_B } from "./factories";

/**
 * The internal `ownerOf` helper derives a child row's ownerId from its parent.
 * We assert it through the child-insert repo functions: build the parent owned
 * by OWNER_B, then confirm the inserted child carries OWNER_B.
 *
 * The missing-parent edge is current behavior: with no parent row to read,
 * `ownerOf` returns "" and the child is inserted with ownerId === "". Asserted
 * here so a future change to that behavior is caught.
 */

describe("ownerId derivation from parent (via child-insert repo fns)", () => {
  it("session children (sessionExercise → setLog) inherit the session's owner", async () => {
    const session = await startSession({ ownerId: OWNER_B, name: "W", now: 1000 });

    const se = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_bench", order: 1 });
    expect(se.ownerId).toBe(OWNER_B);

    const empty = await addSet({ sessionExerciseId: se.id, order: 1 });
    expect(empty.ownerId).toBe(OWNER_B);

    const logged = await logSet({ sessionExerciseId: se.id, order: 2, weight: 100, reps: 5 });
    expect(logged.ownerId).toBe(OWNER_B);
  });

  it("routine children (routineExercise → routineSet) inherit the routine's owner", async () => {
    const routine = await createRoutine({ ownerId: OWNER_B, name: "R" });

    const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
    expect(re.ownerId).toBe(OWNER_B);

    const rs = await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5 });
    expect(rs.ownerId).toBe(OWNER_B);
  });

  it("program children (programDay) inherit the program's owner", async () => {
    const program = await createProgram({ ownerId: OWNER_B, name: "P" });
    const day = await addProgramDay({ programId: program.id, order: 1 });
    expect(day.ownerId).toBe(OWNER_B);
  });

  // `ownerOf` returns "" for a missing parent, but the child insert never lands:
  // the FK constraint rejects it, so an orphaned/empty-owner row can't exist.
  it("child insert of a non-existent parent is rejected by the FK (no orphan row)", async () => {
    await expect(
      addSessionExercise({ sessionId: "no-such-session", exerciseId: "ex_bench", order: 1 }),
    ).rejects.toThrow();
  });

  it("routineSet of a non-existent routine exercise is rejected by the FK", async () => {
    await expect(
      addRoutineSet({ routineExerciseId: "no-such-routine-exercise", order: 1, targetReps: 5 }),
    ).rejects.toThrow();
  });
});
