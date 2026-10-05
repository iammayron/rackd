import { beforeEach, describe, it, expect } from "vitest";
import {
  createRoutine,
  addRoutineExercise,
  startSession,
  addSessionExercise,
  createProgram,
  addProgramDay,
  db,
  schema,
} from "@rackd/db";
import { eq } from "drizzle-orm";
import { resetDb, authedRequest, ctx } from "../db-helper";
import { PUT as routineReorder } from "@/app/api/routines/[id]/exercises/reorder/route";
import { PUT as programReorder } from "@/app/api/programs/[id]/days/reorder/route";
import { PUT as sessionReorder } from "@/app/api/sessions/[id]/exercises/reorder/route";

const A = "owner-a";
const B = "owner-b";

const { routineExercises, sessionExercises, programDays } = schema;

function reorderReq(ownerId: string | null, orderedIds: string[]) {
  return authedRequest(`http://t/x`, ownerId, {
    method: "PUT",
    body: JSON.stringify({ orderedIds }),
  });
}

describe("reorder routes owner isolation", () => {
  beforeEach(() => resetDb());

  /* -------------------- routines/[id]/exercises/reorder -------------------- */

  describe("/api/routines/[id]/exercises/reorder", () => {
    async function seed(ownerId: string) {
      const routine = await createRoutine({ ownerId, name: "Plan" });
      const a = await addRoutineExercise({
        routineId: routine.id,
        exerciseId: "ex_bench",
        order: 1,
      });
      const b = await addRoutineExercise({
        routineId: routine.id,
        exerciseId: "ex_squat",
        order: 2,
      });
      return { routineId: routine.id, aId: a.id, bId: b.id };
    }

    it("owner reorders successfully → order becomes 1-based per orderedIds", async () => {
      const { routineId, aId, bId } = await seed(A);
      const res = await routineReorder(reorderReq(A, [bId, aId]), ctx({ id: routineId }));
      expect(res.status).toBe(200);
      const [a] = await db.select().from(routineExercises).where(eq(routineExercises.id, aId));
      const [b] = await db.select().from(routineExercises).where(eq(routineExercises.id, bId));
      expect(b!.order).toBe(1);
      expect(a!.order).toBe(2);
    });

    it("401 without a token", async () => {
      const { routineId, aId, bId } = await seed(A);
      const res = await routineReorder(reorderReq(null, [bId, aId]), ctx({ id: routineId }));
      expect(res.status).toBe(401);
    });

    it("non-owner is rejected and the order is unchanged", async () => {
      const { routineId, aId, bId } = await seed(A);
      const res = await routineReorder(reorderReq(B, [bId, aId]), ctx({ id: routineId }));
      expect([403, 404]).toContain(res.status);
      const [a] = await db.select().from(routineExercises).where(eq(routineExercises.id, aId));
      const [b] = await db.select().from(routineExercises).where(eq(routineExercises.id, bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });

    // NOTE: may fail — the route guards the PARENT routine's owner but passes
    // `orderedIds` straight to reorderRoutineExercises with NO check that those
    // child ids belong to the parent (or to the caller). So B, owning their own
    // routine, can pass A's routineExercise ids and silently rewrite A's order.
    // Secure behavior: A's rows must be untouched.
    it("does NOT let an owner reorder another owner's exercise rows via crafted ids", async () => {
      const victim = await seed(A);
      const attacker = await createRoutine({ ownerId: B, name: "Decoy" });
      // B reorders THEIR OWN routine but slips A's child ids into orderedIds.
      const res = await routineReorder(
        reorderReq(B, [victim.bId, victim.aId]),
        ctx({ id: attacker.id }),
      );
      // Whatever the status, A's rows must keep their original order.
      void res;
      const [a] = await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.id, victim.aId));
      const [b] = await db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.id, victim.bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });
  });

  /* ---------------------- programs/[id]/days/reorder ---------------------- */

  describe("/api/programs/[id]/days/reorder", () => {
    async function seed(ownerId: string) {
      const program = await createProgram({ ownerId, name: "Block" });
      const a = await addProgramDay({ programId: program.id, order: 1, name: "D1" });
      const b = await addProgramDay({ programId: program.id, order: 2, name: "D2" });
      return { programId: program.id, aId: a.id, bId: b.id };
    }

    it("owner reorders successfully → order becomes 1-based per orderedIds", async () => {
      const { programId, aId, bId } = await seed(A);
      const res = await programReorder(reorderReq(A, [bId, aId]), ctx({ id: programId }));
      expect(res.status).toBe(200);
      const [a] = await db.select().from(programDays).where(eq(programDays.id, aId));
      const [b] = await db.select().from(programDays).where(eq(programDays.id, bId));
      expect(b!.order).toBe(1);
      expect(a!.order).toBe(2);
    });

    it("401 without a token", async () => {
      const { programId, aId, bId } = await seed(A);
      const res = await programReorder(reorderReq(null, [bId, aId]), ctx({ id: programId }));
      expect(res.status).toBe(401);
    });

    it("non-owner is rejected and the order is unchanged", async () => {
      const { programId, aId, bId } = await seed(A);
      const res = await programReorder(reorderReq(B, [bId, aId]), ctx({ id: programId }));
      expect([403, 404]).toContain(res.status);
      const [a] = await db.select().from(programDays).where(eq(programDays.id, aId));
      const [b] = await db.select().from(programDays).where(eq(programDays.id, bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });

    // NOTE: may fail — same gap as routines: parent-owner guarded, child ids not.
    // Secure behavior: A's program days must be untouched.
    it("does NOT let an owner reorder another owner's program days via crafted ids", async () => {
      const victim = await seed(A);
      const attacker = await createProgram({ ownerId: B, name: "Decoy" });
      const res = await programReorder(
        reorderReq(B, [victim.bId, victim.aId]),
        ctx({ id: attacker.id }),
      );
      void res;
      const [a] = await db.select().from(programDays).where(eq(programDays.id, victim.aId));
      const [b] = await db.select().from(programDays).where(eq(programDays.id, victim.bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });
  });

  /* --------------------- sessions/[id]/exercises/reorder --------------------- */

  describe("/api/sessions/[id]/exercises/reorder", () => {
    async function seed(ownerId: string) {
      const session = await startSession({ ownerId, name: "Workout", now: Date.now() });
      const a = await addSessionExercise({
        sessionId: session.id,
        exerciseId: "ex_bench",
        order: 1,
      });
      const b = await addSessionExercise({
        sessionId: session.id,
        exerciseId: "ex_squat",
        order: 2,
      });
      return { sessionId: session.id, aId: a.id, bId: b.id };
    }

    it("owner reorders successfully → order becomes 1-based per orderedIds", async () => {
      const { sessionId, aId, bId } = await seed(A);
      const res = await sessionReorder(reorderReq(A, [bId, aId]), ctx({ id: sessionId }));
      expect(res.status).toBe(200);
      const [a] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, aId));
      const [b] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, bId));
      expect(b!.order).toBe(1);
      expect(a!.order).toBe(2);
    });

    it("401 without a token", async () => {
      const { sessionId, aId, bId } = await seed(A);
      const res = await sessionReorder(reorderReq(null, [bId, aId]), ctx({ id: sessionId }));
      expect(res.status).toBe(401);
    });

    it("non-owner is rejected and the order is unchanged", async () => {
      const { sessionId, aId, bId } = await seed(A);
      const res = await sessionReorder(reorderReq(B, [bId, aId]), ctx({ id: sessionId }));
      expect([403, 404]).toContain(res.status);
      const [a] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, aId));
      const [b] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });

    // NOTE: may fail — same gap: parent-owner guarded, child ids not validated.
    // Secure behavior: A's session exercises must be untouched.
    it("does NOT let an owner reorder another owner's session exercises via crafted ids", async () => {
      const victim = await seed(A);
      const attacker = await startSession({ ownerId: B, name: "Decoy", now: Date.now() });
      const res = await sessionReorder(
        reorderReq(B, [victim.bId, victim.aId]),
        ctx({ id: attacker.id }),
      );
      void res;
      const [a] = await db
        .select()
        .from(sessionExercises)
        .where(eq(sessionExercises.id, victim.aId));
      const [b] = await db
        .select()
        .from(sessionExercises)
        .where(eq(sessionExercises.id, victim.bId));
      expect(a!.order).toBe(1);
      expect(b!.order).toBe(2);
    });
  });
});
