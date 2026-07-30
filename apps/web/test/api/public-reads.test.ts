import { beforeEach, describe, it, expect } from "vitest";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  publishRoutine,
  db,
  schema,
} from "@rackd/db";
import { eq } from "drizzle-orm";
import { resetDb, authedRequest, ctx } from "../db-helper";
import { GET as exercisesGet, POST as exercisesPost } from "@/app/api/exercises/route";
import { GET as sharedGet } from "@/app/api/shared-routines/route";
import { POST as sharedClone } from "@/app/api/shared-routines/[id]/clone/route";

const A = "owner-a";
const B = "owner-b";

const { routines } = schema;

/** Create a custom exercise owned by `ownerId` via the real POST route; return its id. */
async function createCustomExercise(ownerId: string, name: string): Promise<string> {
  const res = await exercisesPost(
    authedRequest(`http://t/api/exercises`, ownerId, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
    ctx({}),
  );
  expect(res.status).toBe(201);
  return (await res.json()).id as string;
}

describe("public / shared reads", () => {
  beforeEach(() => resetDb());

  /* --------------------------------- exercises --------------------------------- */

  it("GET /api/exercises returns the library (ownerId null) to everyone", async () => {
    const res = await exercisesGet(authedRequest(`http://t/api/exercises`, B), ctx({}));
    expect(res.status).toBe(200);
    const rows = await res.json();
    const ids = rows.map((r: { id: string }) => r.id);
    expect(ids).toContain("ex_bench");
    expect(ids).toContain("ex_squat");
  });

  it("A's custom exercise is visible to A but NOT to B; B's is not visible to A", async () => {
    const aCustom = await createCustomExercise(A, "A's Curl");
    const bCustom = await createCustomExercise(B, "B's Row");

    const aRes = await exercisesGet(authedRequest(`http://t/api/exercises`, A), ctx({}));
    const aIds = (await aRes.json()).map((r: { id: string }) => r.id);
    expect(aIds).toContain(aCustom);
    expect(aIds).not.toContain(bCustom);

    const bRes = await exercisesGet(authedRequest(`http://t/api/exercises`, B), ctx({}));
    const bIds = (await bRes.json()).map((r: { id: string }) => r.id);
    expect(bIds).toContain(bCustom);
    expect(bIds).not.toContain(aCustom);
    // Both still see the shared library.
    expect(bIds).toContain("ex_bench");
  });

  /* ------------------------------ shared-routines ------------------------------ */

  it("GET /api/shared-routines returns the public catalog to any authed user", async () => {
    // A publishes a routine into the shared catalog.
    const routine = await createRoutine({ ownerId: A, name: "PPL" });
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 100 });
    const shared = await publishRoutine({
      routineId: routine.id,
      ownerId: A,
      authorName: "A",
      now: Date.now(),
    });
    expect(shared).not.toBeNull();

    // B (a different user) sees the catalog entry.
    const res = await sharedGet(authedRequest(`http://t/api/shared-routines`, B), ctx({}));
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows.some((r: { id: string }) => r.id === shared!.id)).toBe(true);
  });

  it("401 for shared-routines without a token", async () => {
    const res = await sharedGet(authedRequest(`http://t/api/shared-routines`, null), ctx({}));
    expect(res.status).toBe(401);
  });

  it("POST /api/shared-routines/[id]/clone works for ANY authed user → creates a routine owned by the caller", async () => {
    // A publishes; B clones it.
    const routine = await createRoutine({ ownerId: A, name: "PPL" });
    const re = await addRoutineExercise({
      routineId: routine.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 100 });
    const shared = await publishRoutine({
      routineId: routine.id,
      ownerId: A,
      authorName: "A",
      now: Date.now(),
    });

    const res = await sharedClone(
      authedRequest(`http://t/api/shared-routines/${shared!.id}/clone`, B, { method: "POST" }),
      ctx({ id: shared!.id }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(typeof body.id).toBe("string");

    // The clone is a real routine owned by B.
    const [cloned] = await db.select().from(routines).where(eq(routines.id, body.id));
    expect(cloned).toBeTruthy();
    expect(cloned!.ownerId).toBe(B);
    expect(cloned!.name).toBe("PPL");
  });
});
