import { beforeEach, describe, it, expect } from "vitest";
import {
  createRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSession,
  addSessionExercise,
  logSet,
  createProgram,
  addProgramDay,
  db,
  schema,
} from "@rackd/db";
import { eq } from "drizzle-orm";
import { resetDb, authedRequest, ctx } from "../db-helper";

import { PUT as reExPut, DELETE as reExDel } from "@/app/api/routine-exercises/[id]/route";
import { POST as reExReplace } from "@/app/api/routine-exercises/[id]/replace/route";
import { PUT as reSetPut, DELETE as reSetDel } from "@/app/api/routine-sets/[id]/route";
import { POST as reSetCreate } from "@/app/api/routine-sets/route";
import { PUT as seExPut, DELETE as seExDel } from "@/app/api/session-exercises/[id]/route";
import { POST as seExReplace } from "@/app/api/session-exercises/[id]/replace/route";
import { PUT as setLogPut, DELETE as setLogDel } from "@/app/api/set-logs/[id]/route";
import { POST as setLogCreate } from "@/app/api/set-logs/route";
import { GET as sessionGet } from "@/app/api/sessions/[id]/route";
import { POST as sessionFinish } from "@/app/api/sessions/[id]/finish/route";
import { POST as sessionDiscard } from "@/app/api/sessions/[id]/discard/route";
import { GET as programGet, PUT as programPut, DELETE as programDel } from "@/app/api/programs/[id]/route";
import { PUT as programDayPut, DELETE as programDayDel } from "@/app/api/program-days/[id]/route";

const A = "owner-a";
const B = "owner-b";

const { routineExercises, routineSets, sessionExercises, setLogs, sessions, programs, programDays } =
  schema;

/** Seed an owned routine → exercise → set tree; return the ids. */
async function seedRoutineTree(ownerId: string) {
  const routine = await createRoutine({ ownerId, name: "Plan" });
  const re = await addRoutineExercise({ routineId: routine.id, exerciseId: "ex_bench", order: 1 });
  const set = await addRoutineSet({ routineExerciseId: re.id, order: 1, targetReps: 5, targetWeight: 100 });
  return { routineId: routine.id, reId: re.id, setId: set.id };
}

/** Seed an owned session → exercise → setLog tree; return the ids. */
async function seedSessionTree(ownerId: string) {
  const session = await startSession({ ownerId, name: "Workout", now: Date.now() });
  const se = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_bench", order: 1 });
  const log = await logSet({ sessionExerciseId: se.id, order: 1, weight: 100, reps: 5 });
  return { sessionId: session.id, seId: se.id, logId: log.id };
}

/** Seed an owned program → day tree; return the ids. */
async function seedProgramTree(ownerId: string) {
  const program = await createProgram({ ownerId, name: "Block" });
  const day = await addProgramDay({ programId: program.id, order: 1, name: "Day 1" });
  return { programId: program.id, dayId: day.id };
}

describe("API by-id owner isolation", () => {
  beforeEach(() => resetDb());

  /* ----------------------------- routine-exercises ----------------------------- */

  describe("/api/routine-exercises/[id] PUT", () => {
    it("401 without a token", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ restSec: 90 }) }),
        ctx({ id: reId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the row is unchanged", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ restSec: 90 }) }),
        ctx({ id: reId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(routineExercises).where(eq(routineExercises.id, reId));
      expect(row!.restSec).toBe(120); // default, unchanged
    });
  });

  describe("/api/routine-exercises/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: reId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the row still exists", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: reId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(routineExercises).where(eq(routineExercises.id, reId));
      expect(rows.length).toBe(1);
    });
  });

  describe("/api/routine-exercises/[id]/replace POST", () => {
    it("401 without a token", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExReplace(
        authedRequest(`http://t/x`, null, { method: "POST", body: JSON.stringify({ exerciseId: "ex_squat" }) }),
        ctx({ id: reId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the slot's exercise is unchanged", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reExReplace(
        authedRequest(`http://t/x`, B, { method: "POST", body: JSON.stringify({ exerciseId: "ex_squat" }) }),
        ctx({ id: reId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(routineExercises).where(eq(routineExercises.id, reId));
      expect(row!.exerciseId).toBe("ex_bench");
    });
  });

  /* -------------------------------- routine-sets -------------------------------- */

  describe("/api/routine-sets/[id] PUT", () => {
    it("401 without a token", async () => {
      const { setId } = await seedRoutineTree(A);
      const res = await reSetPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ targetReps: 99 }) }),
        ctx({ id: setId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the set is unchanged", async () => {
      const { setId } = await seedRoutineTree(A);
      const res = await reSetPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ targetReps: 99 }) }),
        ctx({ id: setId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(routineSets).where(eq(routineSets.id, setId));
      expect(row!.targetReps).toBe(5);
    });
  });

  describe("/api/routine-sets/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { setId } = await seedRoutineTree(A);
      const res = await reSetDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: setId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the set still exists", async () => {
      const { setId } = await seedRoutineTree(A);
      const res = await reSetDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: setId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(routineSets).where(eq(routineSets.id, setId));
      expect(rows.length).toBe(1);
    });
  });

  describe("/api/routine-sets POST (parent owned by A)", () => {
    it("401 without a token", async () => {
      const { reId } = await seedRoutineTree(A);
      const res = await reSetCreate(
        authedRequest(`http://t/api/routine-sets`, null, {
          method: "POST",
          body: JSON.stringify({ routineExerciseId: reId, order: 2 }),
        }),
        ctx({}),
      );
      expect(res.status).toBe(401);
    });

    it("403 when B adds a set under A's routine exercise, and no set is created", async () => {
      const { reId } = await seedRoutineTree(A);
      const before = await db.select().from(routineSets).where(eq(routineSets.routineExerciseId, reId));
      const res = await reSetCreate(
        authedRequest(`http://t/api/routine-sets`, B, {
          method: "POST",
          body: JSON.stringify({ routineExerciseId: reId, order: 2, targetReps: 8 }),
        }),
        ctx({}),
      );
      expect(res.status).toBe(403);
      const after = await db.select().from(routineSets).where(eq(routineSets.routineExerciseId, reId));
      expect(after.length).toBe(before.length);
    });
  });

  /* ------------------------------ session-exercises ----------------------------- */

  describe("/api/session-exercises/[id] PUT", () => {
    it("401 without a token", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ restSec: 90 }) }),
        ctx({ id: seId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the row is unchanged", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ restSec: 90 }) }),
        ctx({ id: seId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, seId));
      expect(row!.restSec).toBe(120);
    });
  });

  describe("/api/session-exercises/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: seId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the row still exists", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: seId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(sessionExercises).where(eq(sessionExercises.id, seId));
      expect(rows.length).toBe(1);
    });
  });

  describe("/api/session-exercises/[id]/replace POST", () => {
    it("401 without a token", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExReplace(
        authedRequest(`http://t/x`, null, { method: "POST", body: JSON.stringify({ exerciseId: "ex_squat" }) }),
        ctx({ id: seId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the slot's exercise is unchanged", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await seExReplace(
        authedRequest(`http://t/x`, B, { method: "POST", body: JSON.stringify({ exerciseId: "ex_squat" }) }),
        ctx({ id: seId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(sessionExercises).where(eq(sessionExercises.id, seId));
      expect(row!.exerciseId).toBe("ex_bench");
    });
  });

  /* ---------------------------------- set-logs ---------------------------------- */

  describe("/api/set-logs/[id] PUT", () => {
    it("401 without a token", async () => {
      const { logId } = await seedSessionTree(A);
      const res = await setLogPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ reps: 99 }) }),
        ctx({ id: logId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the logged set is unchanged", async () => {
      const { logId } = await seedSessionTree(A);
      const res = await setLogPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ reps: 99 }) }),
        ctx({ id: logId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(setLogs).where(eq(setLogs.id, logId));
      expect(row!.reps).toBe(5);
    });
  });

  describe("/api/set-logs/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { logId } = await seedSessionTree(A);
      const res = await setLogDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: logId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the logged set still exists", async () => {
      const { logId } = await seedSessionTree(A);
      const res = await setLogDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: logId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(setLogs).where(eq(setLogs.id, logId));
      expect(rows.length).toBe(1);
    });
  });

  describe("/api/set-logs POST (parent owned by A)", () => {
    it("401 without a token", async () => {
      const { seId } = await seedSessionTree(A);
      const res = await setLogCreate(
        authedRequest(`http://t/api/set-logs`, null, {
          method: "POST",
          body: JSON.stringify({ sessionExerciseId: seId, order: 2 }),
        }),
        ctx({}),
      );
      expect(res.status).toBe(401);
    });

    it("403 when B posts a set under A's session exercise, and no set is created", async () => {
      const { seId } = await seedSessionTree(A);
      const before = await db.select().from(setLogs).where(eq(setLogs.sessionExerciseId, seId));
      const res = await setLogCreate(
        authedRequest(`http://t/api/set-logs`, B, {
          method: "POST",
          body: JSON.stringify({ sessionExerciseId: seId, order: 2, weight: 50, reps: 5, completed: true }),
        }),
        ctx({}),
      );
      expect(res.status).toBe(403);
      const after = await db.select().from(setLogs).where(eq(setLogs.sessionExerciseId, seId));
      expect(after.length).toBe(before.length);
    });
  });

  /* ---------------------------------- sessions ---------------------------------- */

  describe("/api/sessions/[id] GET", () => {
    it("401 without a token", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionGet(authedRequest(`http://t/x`, null), ctx({ id: sessionId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionGet(authedRequest(`http://t/x`, B), ctx({ id: sessionId }));
      expect(res.status).toBe(403);
    });
  });

  describe("/api/sessions/[id]/finish POST", () => {
    it("401 without a token", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionFinish(authedRequest(`http://t/x`, null, { method: "POST" }), ctx({ id: sessionId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the session is not ended", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionFinish(authedRequest(`http://t/x`, B, { method: "POST" }), ctx({ id: sessionId }));
      expect(res.status).toBe(403);
      const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      expect(row!.endedAt).toBeNull();
    });
  });

  describe("/api/sessions/[id]/discard POST", () => {
    it("401 without a token", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionDiscard(authedRequest(`http://t/x`, null, { method: "POST" }), ctx({ id: sessionId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the session still exists", async () => {
      const { sessionId } = await seedSessionTree(A);
      const res = await sessionDiscard(authedRequest(`http://t/x`, B, { method: "POST" }), ctx({ id: sessionId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      expect(rows.length).toBe(1);
    });
  });

  /* ---------------------------------- programs ---------------------------------- */

  describe("/api/programs/[id] GET", () => {
    it("401 without a token", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programGet(authedRequest(`http://t/x`, null), ctx({ id: programId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programGet(authedRequest(`http://t/x`, B), ctx({ id: programId }));
      expect(res.status).toBe(403);
    });
  });

  describe("/api/programs/[id] PUT", () => {
    it("401 without a token", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ name: "Hacked" }) }),
        ctx({ id: programId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the program is unchanged", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ name: "Hacked" }) }),
        ctx({ id: programId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(programs).where(eq(programs.id, programId));
      expect(row!.name).toBe("Block");
    });
  });

  describe("/api/programs/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: programId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the program still exists", async () => {
      const { programId } = await seedProgramTree(A);
      const res = await programDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: programId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(programs).where(eq(programs.id, programId));
      expect(rows.length).toBe(1);
    });
  });

  /* -------------------------------- program-days -------------------------------- */

  describe("/api/program-days/[id] PUT", () => {
    it("401 without a token", async () => {
      const { dayId } = await seedProgramTree(A);
      const res = await programDayPut(
        authedRequest(`http://t/x`, null, { method: "PUT", body: JSON.stringify({ name: "Hacked" }) }),
        ctx({ id: dayId }),
      );
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the day is unchanged", async () => {
      const { dayId } = await seedProgramTree(A);
      const res = await programDayPut(
        authedRequest(`http://t/x`, B, { method: "PUT", body: JSON.stringify({ name: "Hacked" }) }),
        ctx({ id: dayId }),
      );
      expect(res.status).toBe(403);
      const [row] = await db.select().from(programDays).where(eq(programDays.id, dayId));
      expect(row!.name).toBe("Day 1");
    });
  });

  describe("/api/program-days/[id] DELETE", () => {
    it("401 without a token", async () => {
      const { dayId } = await seedProgramTree(A);
      const res = await programDayDel(authedRequest(`http://t/x`, null, { method: "DELETE" }), ctx({ id: dayId }));
      expect(res.status).toBe(401);
    });

    it("403 for a non-owner and the day still exists", async () => {
      const { dayId } = await seedProgramTree(A);
      const res = await programDayDel(authedRequest(`http://t/x`, B, { method: "DELETE" }), ctx({ id: dayId }));
      expect(res.status).toBe(403);
      const rows = await db.select().from(programDays).where(eq(programDays.id, dayId));
      expect(rows.length).toBe(1);
    });
  });
});
