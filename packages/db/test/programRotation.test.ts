import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  createProgram,
  addProgramDay,
  setProgramSchedule,
  finishSession,
} from "../src/index";
import { makeRoutine, makeSessionWithSets, OWNER_A } from "./factories";

const cursorOf = async (programId: string) => {
  const [row] = await db
    .select()
    .from(t.programs)
    .where(eq(t.programs.id, programId));
  return row!.rotationCursor ?? 0;
};

/**
 * Finishing a scheduled workout advances the active rotation program's cursor so
 * the next day becomes "today" (it previously only moved on an explicit Skip).
 */
describe("finishSession — rotation cursor advance", () => {
  it("advances to the day after the one just finished", async () => {
    const push = await makeRoutine({ name: "Push" });
    const pull = await makeRoutine({ name: "Pull" });
    const legs = await makeRoutine({ name: "Legs" });
    const program = await createProgram({ ownerId: OWNER_A, name: "PPL" }); // auto-active
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: push.routineId,
    });
    await addProgramDay({
      programId: program.id,
      order: 2,
      routineId: pull.routineId,
    });
    await addProgramDay({
      programId: program.id,
      order: 3,
      routineId: legs.routineId,
    });

    // Cursor starts at 0 (Push). Finishing Push → cursor 1 (Pull).
    const { sessionId } = await makeSessionWithSets({
      routineId: push.routineId,
      sets: [{ weight: 100, reps: 5 }],
    });
    await finishSession(sessionId, 1000);

    expect(await cursorOf(program.id)).toBe(1);
  });

  it("wraps to 0 after finishing the last day", async () => {
    const a = await makeRoutine({ name: "A" });
    const b = await makeRoutine({ name: "B" });
    const program = await createProgram({ ownerId: OWNER_A, name: "AB" });
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: a.routineId,
    });
    await addProgramDay({
      programId: program.id,
      order: 2,
      routineId: b.routineId,
    });
    await setProgramSchedule(program.id, { rotationCursor: 1 }); // parked on B

    const { sessionId } = await makeSessionWithSets({
      routineId: b.routineId,
      sets: [{ weight: 50, reps: 5 }],
    });
    await finishSession(sessionId, 2000);

    expect(await cursorOf(program.id)).toBe(0);
  });

  it("moves to the day after one finished out of order (e.g. Home 'Train next')", async () => {
    const a = await makeRoutine({ name: "A" });
    const b = await makeRoutine({ name: "B" });
    const c = await makeRoutine({ name: "C" });
    const program = await createProgram({ ownerId: OWNER_A, name: "ABC" });
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: a.routineId,
    });
    await addProgramDay({
      programId: program.id,
      order: 2,
      routineId: b.routineId,
    });
    await addProgramDay({
      programId: program.id,
      order: 3,
      routineId: c.routineId,
    });
    // Cursor is on A (0), but the user trains C. Finishing C (index 2) → cursor 0.
    const { sessionId } = await makeSessionWithSets({
      routineId: c.routineId,
      sets: [{ weight: 60, reps: 5 }],
    });
    await finishSession(sessionId, 3000);

    expect(await cursorOf(program.id)).toBe(0);
  });

  it("does not advance for a quick (routine-less) session", async () => {
    const a = await makeRoutine({ name: "A" });
    const program = await createProgram({ ownerId: OWNER_A, name: "P" });
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: a.routineId,
    });

    const { sessionId } = await makeSessionWithSets({
      sets: [{ weight: 40, reps: 5 }],
    }); // no routineId → quick workout
    await finishSession(sessionId, 4000);

    expect(await cursorOf(program.id)).toBe(0);
  });

  it("does not advance a weekly-mode program", async () => {
    const a = await makeRoutine({ name: "A" });
    const program = await createProgram({ ownerId: OWNER_A, name: "P" });
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: a.routineId,
      weekday: 1,
    });
    await setProgramSchedule(program.id, { scheduleMode: "weekly" });

    const { sessionId } = await makeSessionWithSets({
      routineId: a.routineId,
      sets: [{ weight: 70, reps: 5 }],
    });
    await finishSession(sessionId, 5000);

    expect(await cursorOf(program.id)).toBe(0);
  });

  it("does not advance when the finished routine isn't in the active program", async () => {
    const inProgram = await makeRoutine({ name: "In" });
    const other = await makeRoutine({ name: "Other" });
    const program = await createProgram({ ownerId: OWNER_A, name: "P" });
    await addProgramDay({
      programId: program.id,
      order: 1,
      routineId: inProgram.routineId,
    });

    const { sessionId } = await makeSessionWithSets({
      routineId: other.routineId,
      sets: [{ weight: 80, reps: 5 }],
    });
    await finishSession(sessionId, 6000);

    expect(await cursorOf(program.id)).toBe(0);
  });
});
