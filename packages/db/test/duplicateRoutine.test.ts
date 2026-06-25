import { describe, it, expect } from "vitest";
import { eq, asc } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  setRoutineSchedule,
  duplicateRoutine,
  renameRoutine,
} from "../src/index";
import { OWNER_A } from "./factories";

const routinesNamed = (name: string, ownerId = OWNER_A) =>
  db
    .select()
    .from(t.routines)
    .where(eq(t.routines.ownerId, ownerId))
    .then((rows) => rows.filter((r) => r.name === name));

const exercisesOf = (routineId: string) =>
  db
    .select()
    .from(t.routineExercises)
    .where(eq(t.routineExercises.routineId, routineId))
    .orderBy(asc(t.routineExercises.order));

const setsOf = (routineExerciseId: string) =>
  db
    .select()
    .from(t.routineSets)
    .where(eq(t.routineSets.routineExerciseId, routineExerciseId))
    .orderBy(asc(t.routineSets.order));

describe("duplicateRoutine", () => {
  it('escalates the copy name ("(copy)", then "(copy 2)")', async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Push" });

    const firstCopyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A });
    expect(firstCopyId).not.toBeNull();
    expect((await routinesNamed("Push (copy)"))).toHaveLength(1);

    // "Push (copy)" now exists, so the next duplicate escalates to "(copy 2)".
    const secondCopyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A });
    expect(secondCopyId).not.toBeNull();
    expect((await routinesNamed("Push (copy 2)"))).toHaveLength(1);
  });

  it('uses an explicit name verbatim (no "(copy)" suffix) when provided', async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Push" });

    // The save-back "this program" fork reuses the original name so it doesn't
    // surface as a "(copy)"; the name is taken as-is even though it collides.
    const copyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A, name: "Push" });
    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(src.id);
    expect(await routinesNamed("Push")).toHaveLength(2);
    expect(await routinesNamed("Push (copy)")).toHaveLength(0);
  });

  it('falls back to the "(copy)" name when the explicit name is blank', async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Pull" });
    const copyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A, name: "   " });
    expect(copyId).not.toBeNull();
    expect(await routinesNamed("Pull (copy)")).toHaveLength(1);
  });

  it("deep-clones exercises and sets including targetRpe, tempo, notes", async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Legs" });
    const re = await addRoutineExercise({ routineId: src.id, exerciseId: "ex_squat", order: 1 });
    const rs = await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 140 });
    // Fields not exposed by repo setters — set directly to exercise the clone.
    await db.update(t.routineExercises).set({ notes: "brace hard" }).where(eq(t.routineExercises.id, re.id));
    await db.update(t.routineSets).set({ targetRpe: 8.5, tempo: "3-1-1" }).where(eq(t.routineSets.id, rs.id));

    const copyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A });
    const [copyEx] = await exercisesOf(copyId!);
    expect(copyEx!.exerciseId).toBe("ex_squat");
    expect(copyEx!.notes).toBe("brace hard");

    const [copySet] = await setsOf(copyEx!.id);
    expect(copySet!.targetReps).toBe(5);
    expect(copySet!.targetWeight).toBe(140);
    expect(copySet!.targetRpe).toBe(8.5);
    expect(copySet!.tempo).toBe("3-1-1");
  });

  it("carries scheduledDays onto the copy", async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Upper" });
    await setRoutineSchedule(src.id, [1, 3, 5]);

    const copyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A });
    const [copy] = await db.select().from(t.routines).where(eq(t.routines.id, copyId!));
    expect(copy!.scheduledDays).toEqual([1, 3, 5]);
  });

  it("returns null when the source routine is missing", async () => {
    expect(await duplicateRoutine({ routineId: "nope", ownerId: OWNER_A })).toBeNull();
  });

  it("produces an independent copy (editing it leaves the original alone)", async () => {
    const src = await createRoutine({ ownerId: OWNER_A, name: "Original" });
    await addRoutineExercise({ routineId: src.id, exerciseId: "ex_bench", order: 1 });

    const copyId = await duplicateRoutine({ routineId: src.id, ownerId: OWNER_A });
    await renameRoutine(copyId!, "Renamed Copy");

    const [orig] = await db.select().from(t.routines).where(eq(t.routines.id, src.id));
    const [copy] = await db.select().from(t.routines).where(eq(t.routines.id, copyId!));
    expect(orig!.name).toBe("Original");
    expect(copy!.name).toBe("Renamed Copy");
    // Distinct exercise rows, not shared.
    const origEx = await exercisesOf(src.id);
    const copyEx = await exercisesOf(copyId!);
    expect(origEx[0]!.id).not.toBe(copyEx[0]!.id);
  });
});
