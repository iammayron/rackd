import { beforeEach, describe, it, expect } from "vitest";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSession,
  addSessionExercise,
  logSet,
  db,
  schema,
} from "@rackd/db";
import { asc, eq } from "drizzle-orm";
import { resetDb, authedRequest, ctx } from "../db-helper";
import { POST as saveBack } from "@/app/api/sessions/[id]/save-back/route";
import { GET as routineGet } from "@/app/api/routines/[id]/route";

const A = "owner-a";
const B = "owner-b";

const { routineSets } = schema;

/** A routine with one exercise + one prescribed set. */
async function seedRoutine(ownerId: string, reps: number) {
  const routine = await createRoutine({ ownerId, name: "Plan" });
  const re = await addRoutineExercise({
    routineId: routine.id,
    exerciseId: "ex_bench",
    order: 1,
  });
  await addRoutineSet({
    routineExerciseId: re.id,
    order: 1,
    targetReps: reps,
    targetWeight: 100,
  });
  return routine.id;
}

/** A finished-ish session with one exercise + one logged set (heavier than the plan). */
async function seedSession(ownerId: string) {
  const session = await startSession({
    ownerId,
    name: "Workout",
    now: Date.now(),
  });
  const se = await addSessionExercise({
    sessionId: session.id,
    exerciseId: "ex_bench",
    order: 1,
  });
  await logSet({ sessionExerciseId: se.id, order: 1, weight: 140, reps: 8 });
  return session.id;
}

/** Snapshot a routine's prescribed sets (targetReps/targetWeight) for before/after compare. */
async function routineSetSnapshot(routineId: string) {
  // Routine sets are owner-scoped but not directly joined here; read via the tree.
  const reRows = await db
    .select()
    .from(schema.routineExercises)
    .where(eq(schema.routineExercises.routineId, routineId))
    .orderBy(asc(schema.routineExercises.order));
  const out: { targetReps: number | null; targetWeight: number | null }[] = [];
  for (const re of reRows) {
    const sets = await db
      .select()
      .from(routineSets)
      .where(eq(routineSets.routineExerciseId, re.id))
      .orderBy(asc(routineSets.order));
    for (const s of sets) out.push({ targetReps: s.targetReps, targetWeight: s.targetWeight });
  }
  return out;
}

describe("/api/sessions/[id]/save-back owner isolation", () => {
  beforeEach(() => resetDb());

  it("A's session + A's routine + valid mode → 200 and the routine is updated", async () => {
    const sessionId = await seedSession(A);
    const routineId = await seedRoutine(A, 5);
    const before = await routineSetSnapshot(routineId);

    const res = await saveBack(
      authedRequest(`http://t/x`, A, {
        method: "POST",
        body: JSON.stringify({ routineId, mode: "everything" }),
      }),
      ctx({ id: sessionId }),
    );
    expect(res.status).toBe(200);

    const after = await routineSetSnapshot(routineId);
    // "everything" writes the performed numbers (140kg x 8) back over the plan (100kg x 5).
    expect(after).not.toEqual(before);
    expect(after.some((s) => s.targetReps === 8 && s.targetWeight === 140)).toBe(true);
  });

  it("links the session to the routine it was saved back into (forked program copy)", async () => {
    // The "this program" fork repoints the program day at a copy and saves the
    // session back into it; the session must follow so the home screen can tell
    // today's scheduled workout was already done.
    const sessionId = await seedSession(A); // starts with no routineId
    const routineId = await seedRoutine(A, 5);

    const res = await saveBack(
      authedRequest(`http://t/x`, A, {
        method: "POST",
        body: JSON.stringify({ routineId, mode: "everything" }),
      }),
      ctx({ id: sessionId }),
    );
    expect(res.status).toBe(200);

    const [session] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId))
      .limit(1);
    expect(session?.routineId).toBe(routineId);
  });

  it("A's session + B's routineId → 403/404 and B's routine is UNCHANGED (cross-owner write guard)", async () => {
    const sessionId = await seedSession(A);
    const routineB = await seedRoutine(B, 5);
    const before = await routineSetSnapshot(routineB);

    const res = await saveBack(
      authedRequest(`http://t/x`, A, {
        method: "POST",
        body: JSON.stringify({ routineId: routineB, mode: "everything" }),
      }),
      ctx({ id: sessionId }),
    );
    expect([403, 404]).toContain(res.status);

    const after = await routineSetSnapshot(routineB);
    expect(after).toEqual(before); // key regression guard: B's plan untouched
  });

  it("B calling on A's session → 403/404", async () => {
    const sessionId = await seedSession(A);
    const routineA = await seedRoutine(A, 5);

    const res = await saveBack(
      authedRequest(`http://t/x`, B, {
        method: "POST",
        body: JSON.stringify({ routineId: routineA, mode: "everything" }),
      }),
      ctx({ id: sessionId }),
    );
    expect([403, 404]).toContain(res.status);

    // A's routine is still readable and unchanged.
    const owned = await routineGet(authedRequest(`http://t/x`, A), ctx({ id: routineA }));
    expect(owned.status).toBe(200);
  });

  it("invalid mode → 400 and the routine is unchanged", async () => {
    const sessionId = await seedSession(A);
    const routineId = await seedRoutine(A, 5);
    const before = await routineSetSnapshot(routineId);

    const res = await saveBack(
      authedRequest(`http://t/x`, A, {
        method: "POST",
        body: JSON.stringify({ routineId, mode: "bogus" }),
      }),
      ctx({ id: sessionId }),
    );
    expect(res.status).toBe(400);

    const after = await routineSetSnapshot(routineId);
    expect(after).toEqual(before);
  });
});
