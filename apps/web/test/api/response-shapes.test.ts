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
} from "@rackd/db";
import { GET as routineGET, POST as routinePOST } from "@/app/api/routines/route";
import { GET as routineByIdGET, DELETE as routineDELETE } from "@/app/api/routines/[id]/route";
import { GET as sessionByIdGET } from "@/app/api/sessions/[id]/route";
import { POST as sessionsPOST } from "@/app/api/sessions/route";
import { GET as activeSessionGET } from "@/app/api/sessions/active/route";
import { GET as programByIdGET } from "@/app/api/programs/[id]/route";
import { POST as setLogsPOST } from "@/app/api/set-logs/route";
import { resetDb, authedRequest, ctx } from "../db-helper";

const A = "owner-a";

describe("API route response shapes + status codes", () => {
  beforeEach(() => resetDb());

  it("GET /api/routines/[id] returns the nested {exercises:[{exercise,sets}]} tree, ordered", async () => {
    const r = await createRoutine({ ownerId: A, name: "Upper" });
    // Exercise 1 = bench (order 1) with 2 sets; exercise 2 = squat (order 2) with 2 sets.
    const re1 = await addRoutineExercise({ routineId: r.id, exerciseId: "ex_bench", order: 1 });
    const re2 = await addRoutineExercise({ routineId: r.id, exerciseId: "ex_squat", order: 2 });
    // Insert sets out of order to prove the route sorts by `order` asc.
    await addRoutineSet({ routineExerciseId: re1.id, order: 2, targetReps: 8 });
    await addRoutineSet({ routineExerciseId: re1.id, order: 1, targetReps: 10 });
    await addRoutineSet({ routineExerciseId: re2.id, order: 1, targetReps: 5 });
    await addRoutineSet({ routineExerciseId: re2.id, order: 2, targetReps: 5 });

    const res = await routineByIdGET(
      authedRequest(`http://t/api/routines/${r.id}`, A),
      ctx({ id: r.id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    // Top level is the routine row + an `exercises` array.
    expect(body.id).toBe(r.id);
    expect(body.name).toBe("Upper");
    expect(body.exercises).toHaveLength(2);

    // Exercises come back ordered by routineExercise.order.
    const [ex1, ex2] = body.exercises;
    expect(ex1.id).toBe(re1.id);
    expect(ex1.order).toBe(1);
    expect(ex2.id).toBe(re2.id);
    expect(ex2.order).toBe(2);

    // The joined `exercise` row carries the library name + id.
    expect(ex1.exercise.id).toBe("ex_bench");
    expect(ex1.exercise.name).toBe("Bench Press");
    expect(ex2.exercise.id).toBe("ex_squat");
    expect(ex2.exercise.name).toBe("Back Squat");

    // Sets are ordered by routineSet.order asc within each exercise.
    expect(ex1.sets).toHaveLength(2);
    expect(ex1.sets.map((s: { order: number }) => s.order)).toEqual([1, 2]);
    expect(ex1.sets[0].targetReps).toBe(10);
    expect(ex1.sets[1].targetReps).toBe(8);
    expect(ex2.sets).toHaveLength(2);
    expect(ex2.sets.map((s: { order: number }) => s.order)).toEqual([1, 2]);
  });

  it("GET /api/sessions/[id] returns the nested {exercises:[{exercise,sets}]} tree, ordered", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    const se1 = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_bench", order: 1 });
    const se2 = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_squat", order: 2 });
    // Two logged sets on bench, inserted out of order.
    await logSet({ sessionExerciseId: se1.id, order: 2, weight: 60, reps: 8 });
    await logSet({ sessionExerciseId: se1.id, order: 1, weight: 50, reps: 10 });
    await logSet({ sessionExerciseId: se2.id, order: 1, weight: 100, reps: 5 });

    const res = await sessionByIdGET(
      authedRequest(`http://t/api/sessions/${session.id}`, A),
      ctx({ id: session.id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(session.id);
    expect(body.name).toBe("Workout");
    expect(body.exercises).toHaveLength(2);

    const [ex1, ex2] = body.exercises;
    expect(ex1.id).toBe(se1.id);
    expect(ex1.order).toBe(1);
    expect(ex2.id).toBe(se2.id);
    expect(ex2.order).toBe(2);

    // Joined exercise row carries the library name.
    expect(ex1.exercise.id).toBe("ex_bench");
    expect(ex1.exercise.name).toBe("Bench Press");
    expect(ex2.exercise.name).toBe("Back Squat");

    // setLogs ordered by order asc.
    expect(ex1.sets).toHaveLength(2);
    expect(ex1.sets.map((s: { order: number }) => s.order)).toEqual([1, 2]);
    expect(ex1.sets[0].weight).toBe(50);
    expect(ex1.sets[1].weight).toBe(60);
    expect(ex2.sets).toHaveLength(1);
    expect(ex2.sets[0].weight).toBe(100);
  });

  it("GET /api/programs/[id] returns {days:[{routine|null}]}; a Rest day has routine null", async () => {
    const r = await createRoutine({ ownerId: A, name: "Push" });
    const program = await createProgram({ ownerId: A, name: "PPL" });
    // Day 1 has a routine; day 2 is a Rest day (no routineId).
    const d1 = await addProgramDay({ programId: program.id, order: 1, name: "Push", routineId: r.id });
    const d2 = await addProgramDay({ programId: program.id, order: 2, name: "Rest" });

    const res = await programByIdGET(
      authedRequest(`http://t/api/programs/${program.id}`, A),
      ctx({ id: program.id }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.id).toBe(program.id);
    expect(body.name).toBe("PPL");
    expect(body.days).toHaveLength(2);

    const [day1, day2] = body.days;
    expect(day1.id).toBe(d1.id);
    expect(day1.order).toBe(1);
    expect(day1.routine).not.toBeNull();
    expect(day1.routine.id).toBe(r.id);
    expect(day1.routine.name).toBe("Push");

    expect(day2.id).toBe(d2.id);
    expect(day2.order).toBe(2);
    expect(day2.routineId).toBeNull();
    expect(day2.routine).toBeNull();
  });

  it("POST /api/routines returns 201 with the created routine", async () => {
    const res = await routinePOST(
      authedRequest("http://t/api/routines", A, {
        method: "POST",
        body: JSON.stringify({ name: "Fresh" }),
      }),
      ctx({}),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Fresh");
    expect(body.ownerId).toBe(A);
  });

  it("DELETE /api/routines/[id] returns 204 with an empty body and removes the row", async () => {
    const r = await createRoutine({ ownerId: A, name: "Doomed" });
    const res = await routineDELETE(
      authedRequest(`http://t/api/routines/${r.id}`, A, { method: "DELETE" }),
      ctx({ id: r.id }),
    );
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    // The list no longer contains it.
    const list = await routineGET(authedRequest("http://t/api/routines", A), ctx({}));
    const rows = await list.json();
    expect(rows.find((x: { id: string }) => x.id === r.id)).toBeUndefined();
  });

  it("POST /api/sessions from a routine returns 201 and a session linked to that routine", async () => {
    const r = await createRoutine({ ownerId: A, name: "Leg Day" });
    const res = await sessionsPOST(
      authedRequest("http://t/api/sessions", A, {
        method: "POST",
        body: JSON.stringify({ routineId: r.id }),
      }),
      ctx({}),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.routineId).toBe(r.id);
    expect(body.ownerId).toBe(A);
    expect(body.name).toBe("Leg Day");
    expect(body.endedAt ?? null).toBeNull();
  });

  it("GET /api/sessions/active returns the unfinished session, then null after none exist", async () => {
    // No session yet → null.
    const none = await activeSessionGET(authedRequest("http://t/api/sessions/active", A), ctx({}));
    expect(none.status).toBe(200);
    expect(await none.json()).toBeNull();

    // One unfinished session → that row.
    const session = await startSession({ ownerId: A, name: "Live", now: Date.now() });
    const active = await activeSessionGET(authedRequest("http://t/api/sessions/active", A), ctx({}));
    const body = await active.json();
    expect(body).not.toBeNull();
    expect(body.id).toBe(session.id);
    expect(body.endedAt ?? null).toBeNull();
  });

  it("POST /api/set-logs with completed:true takes the logSet branch (completed row)", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    const se = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_bench", order: 1 });

    const res = await setLogsPOST(
      authedRequest("http://t/api/set-logs", A, {
        method: "POST",
        body: JSON.stringify({
          sessionExerciseId: se.id,
          order: 1,
          weight: 80,
          reps: 5,
          completed: true,
        }),
      }),
      ctx({}),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.completed).toBe(true);
    expect(body.weight).toBe(80);
    expect(body.reps).toBe(5);
    expect(body.sessionExerciseId).toBe(se.id);
    expect(body.ownerId).toBe(A);
  });

  it("POST /api/set-logs without completed takes the addSet branch (empty, completed:false)", async () => {
    const session = await startSession({ ownerId: A, name: "Workout", now: Date.now() });
    const se = await addSessionExercise({ sessionId: session.id, exerciseId: "ex_squat", order: 1 });

    const res = await setLogsPOST(
      authedRequest("http://t/api/set-logs", A, {
        method: "POST",
        body: JSON.stringify({ sessionExerciseId: se.id, order: 1 }),
      }),
      ctx({}),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    // addSet defaults: completed false, weight/reps 0, type "normal".
    expect(body.completed).toBe(false);
    expect(body.weight).toBe(0);
    expect(body.reps).toBe(0);
    expect(body.type).toBe("normal");
    expect(body.sessionExerciseId).toBe(se.id);
  });
});
