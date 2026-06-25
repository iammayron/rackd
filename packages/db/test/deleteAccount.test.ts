import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import {
  createProgram,
  addProgramDay,
  addBodyWeightLog,
  updateProfile,
  savePushSubscription,
  schedulePush,
  publishRoutine,
  addRoutineExercise,
  deleteAccountData,
} from "../src/index";
import { makeRoutine, makeSessionWithSets, OWNER_A, OWNER_B } from "./factories";

// Count owner-scoped rows in a table. Every owned table carries `ownerId`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ownedCount = async (table: any, ownerId: string): Promise<number> => {
  const rows = await db.select().from(table).where(eq(table.ownerId, ownerId));
  return rows.length;
};

/**
 * Build a full account for `ownerId`: a routine tree, a session tree, an active
 * program with a day, a body-weight log, a profile, a push subscription with a
 * scheduled push, and a published (public) shared routine. Returns the routine id.
 */
async function seedOwner(ownerId: string, endpoint: string): Promise<string> {
  const { routineId } = await makeRoutine({ ownerId, setsPer: 2 });
  await makeSessionWithSets({
    ownerId,
    routineId,
    sets: [{ weight: 100, reps: 5 }],
  });
  const program = await createProgram({ ownerId, name: "Block", blockWeeks: 4 });
  await addProgramDay({ programId: program.id, order: 1, routineId });
  await addBodyWeightLog({ ownerId, weightKg: 80, loggedAt: Date.now() });
  await updateProfile(ownerId, { displayName: "Me" });
  const sub = await savePushSubscription({
    ownerId,
    endpoint,
    p256dh: "key",
    auth: "auth",
    now: Date.now(),
  });
  await schedulePush({
    ownerId,
    subscriptionId: sub!.id,
    fireAt: Date.now() + 60_000,
    title: "Rest over",
    body: "Go",
    now: Date.now(),
  });
  await publishRoutine({ routineId, ownerId, authorName: "Me", now: Date.now() });
  return routineId;
}

async function insertCustomExercise(ownerId: string, id: string): Promise<void> {
  await db.insert(t.exercises).values({
    id,
    name: "Custom Move",
    primaryMuscle: "chest",
    secondaryMuscles: [],
    equipment: "machine",
    category: "machine",
    isCustom: true,
    ownerId,
  });
}

describe("deleteAccountData", () => {
  it("wipes the owner's data, keeps shared routines, and never touches another owner", async () => {
    await seedOwner(OWNER_A, "endpoint-a");
    const bRoutineId = await seedOwner(OWNER_B, "endpoint-b");

    // A owns a custom exercise that only B's routine references (mirrors an
    // imported shared routine reusing the author's exerciseId) → must survive.
    await insertCustomExercise(OWNER_A, "ex_custom_shared");
    await addRoutineExercise({
      routineId: bRoutineId,
      exerciseId: "ex_custom_shared",
      order: 99,
    });
    // A owns a custom exercise nobody references → must be deleted.
    await insertCustomExercise(OWNER_A, "ex_custom_orphan");

    // Guard against tautologies: confirm A's trees are populated pre-delete.
    expect(await ownedCount(t.routineExercises, OWNER_A)).toBeGreaterThan(0);
    expect(await ownedCount(t.setLogs, OWNER_A)).toBeGreaterThan(0);
    expect(await ownedCount(t.programDays, OWNER_A)).toBe(1);
    expect(await ownedCount(t.scheduledPushes, OWNER_A)).toBe(1);

    await deleteAccountData(OWNER_A);

    // Every owner-A owned table is emptied — roots and cascaded children alike.
    for (const table of [
      t.routines,
      t.routineExercises,
      t.routineSets,
      t.sessions,
      t.sessionExercises,
      t.setLogs,
      t.programs,
      t.programDays,
      t.bodyWeightLogs,
      t.userProfile,
      t.pushSubscriptions,
      t.scheduledPushes,
    ]) {
      expect(await ownedCount(table, OWNER_A)).toBe(0);
    }

    // …except the public shared routines, which outlive the author.
    expect(await ownedCount(t.sharedRoutines, OWNER_A)).toBe(1);

    // Custom exercises: the unreferenced one is gone; the still-referenced stays.
    const aCustomIds = (
      await db.select().from(t.exercises).where(eq(t.exercises.ownerId, OWNER_A))
    ).map((e) => e.id);
    expect(aCustomIds).toContain("ex_custom_shared");
    expect(aCustomIds).not.toContain("ex_custom_orphan");

    // Owner B is fully intact across the board.
    for (const table of [
      t.routines,
      t.sessions,
      t.programs,
      t.bodyWeightLogs,
      t.userProfile,
      t.pushSubscriptions,
      t.scheduledPushes,
      t.sharedRoutines,
    ]) {
      expect(await ownedCount(table, OWNER_B)).toBe(1);
    }
  });
});
