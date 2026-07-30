import { describe, it, expect } from "vitest";
import { eq, and } from "drizzle-orm";
import { estimate1RM } from "@rackd/core";
import { db } from "../src/db";
import * as t from "../src/schema";
import { detectAndRecordPRs, startSession, addSessionExercise, logSet, addSet } from "../src/index";
import { makeSessionWithSets, OWNER_A } from "./factories";

const round1rm = (w: number, reps: number) => Math.round(estimate1RM(w, reps));

/** All PR ledger rows for an exercise + type, newest value first. */
const prs = (exerciseId: string, type: "1rm" | "weight") =>
  db
    .select()
    .from(t.personalRecords)
    .where(and(eq(t.personalRecords.exerciseId, exerciseId), eq(t.personalRecords.type, type)));

const setRow = (id: string) => db.select().from(t.setLogs).where(eq(t.setLogs.id, id)).limit(1);

describe("detectAndRecordPRs (real Postgres)", () => {
  it("records a new 1RM PR when no prior ledger row exists; value = round(estimate1RM(best set))", async () => {
    const { sessionId, setIds } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 1000 });

    const expected = round1rm(100, 5); // 117
    const oneRm = found.find((p) => p.type === "1rm");
    expect(oneRm).toEqual({ exerciseId: "ex_bench", type: "1rm", value: expected });

    const rows = await prs("ex_bench", "1rm");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(expected);
    expect(rows[0]!.sessionId).toBe(sessionId);
    expect(rows[0]!.achievedAt).toBe(1000);

    const [s] = await setRow(setIds[0]!);
    expect(s!.isPr).toBe(true);
  });

  it("records a new max-weight PR when no prior ledger row exists; value = heaviest set weight", async () => {
    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 2000 });

    const w = found.find((p) => p.type === "weight");
    expect(w).toEqual({ exerciseId: "ex_bench", type: "weight", value: 100 });

    const rows = await prs("ex_bench", "weight");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.value).toBe(100);
  });

  it("the 1rm and weight ledgers are independent and may flag DIFFERENT sets", async () => {
    // Set A: 120x5 -> est1RM 140 (wins 1RM), weight 120.
    // Set B: 130x1 -> est1RM 130, weight 130 (wins weight).
    const { sessionId, setIds } = await makeSessionWithSets({
      sets: [
        { weight: 120, reps: 5 },
        { weight: 130, reps: 1 },
      ],
    });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 3000 });

    const expected1rm = round1rm(120, 5); // 140
    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "1rm", value: expected1rm });
    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "weight", value: 130 });

    const [setA] = await setRow(setIds[0]!); // 120x5
    const [setB] = await setRow(setIds[1]!); // 130x1
    expect(setA!.isPr).toBe(true); // contributing 1RM set
    expect(setB!.isPr).toBe(true); // contributing weight set
    // sanity: A did NOT win weight, B did NOT win 1RM, but both got flagged once each
    expect(round1rm(130, 1)).toBeLessThan(expected1rm);
  });

  it("isPr lands on the contributing set(s), not the others", async () => {
    // Heaviest 1RM & weight both come from the 100x5 set; the 60x5 warmup loses both.
    const { sessionId, setIds } = await makeSessionWithSets({
      sets: [
        { weight: 60, reps: 5 },
        { weight: 100, reps: 5 },
      ],
    });
    await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 4000 });

    const [warmup] = await setRow(setIds[0]!);
    const [winner] = await setRow(setIds[1]!);
    expect(warmup!.isPr).toBe(false);
    expect(winner!.isPr).toBe(true);
  });

  it("records NO new PR when the session does not beat the prior ledger value", async () => {
    // Prior all-time: 1RM 200, weight 150.
    await db.insert(t.personalRecords).values([
      {
        id: "pr_1rm_prior",
        ownerId: OWNER_A,
        exerciseId: "ex_bench",
        type: "1rm",
        value: 200,
        sessionId: "old_session",
        achievedAt: 1,
      },
      {
        id: "pr_w_prior",
        ownerId: OWNER_A,
        exerciseId: "ex_bench",
        type: "weight",
        value: 150,
        sessionId: "old_session",
        achievedAt: 1,
      },
    ]);

    // A weaker session: 100x5 -> 1RM 117, weight 100. Beats neither.
    const { sessionId, setIds } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 5000 });

    expect(found).toEqual([]);
    expect(await prs("ex_bench", "1rm")).toHaveLength(1); // only the prior row
    expect(await prs("ex_bench", "weight")).toHaveLength(1);
    const [s] = await setRow(setIds[0]!);
    expect(s!.isPr).toBe(false);
  });

  it("a tie does NOT count (uses > not >=): equal to prior produces no new row", async () => {
    const prior1rm = round1rm(100, 5); // 117
    await db.insert(t.personalRecords).values([
      {
        id: "pr_1rm_eq",
        ownerId: OWNER_A,
        exerciseId: "ex_bench",
        type: "1rm",
        value: prior1rm,
        sessionId: "old_session",
        achievedAt: 1,
      },
      {
        id: "pr_w_eq",
        ownerId: OWNER_A,
        exerciseId: "ex_bench",
        type: "weight",
        value: 100,
        sessionId: "old_session",
        achievedAt: 1,
      },
    ]);

    // Exactly equal performance: 100x5.
    const { sessionId, setIds } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 6000 });

    expect(found).toEqual([]);
    expect(await prs("ex_bench", "1rm")).toHaveLength(1);
    expect(await prs("ex_bench", "weight")).toHaveLength(1);
    const [s] = await setRow(setIds[0]!);
    expect(s!.isPr).toBe(false);
  });

  it("strictly beating prior by one records the new PR (boundary above the tie)", async () => {
    await db.insert(t.personalRecords).values({
      id: "pr_w_99",
      ownerId: OWNER_A,
      exerciseId: "ex_bench",
      type: "weight",
      value: 99,
      sessionId: "old_session",
      achievedAt: 1,
    });

    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 1 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 7000 });

    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "weight", value: 100 });
    expect(await prs("ex_bench", "weight")).toHaveLength(2); // prior + new
  });

  it("best1rm > 0 guard: a session with only 0-weight/0-rep completed sets records nothing", async () => {
    // All sets are 0kg, so est1RM is 0 AND topWeight is 0 — neither ledger fires.
    // (A 0-rep set with real weight WOULD still set a weight PR — the repo guards
    // weight>0, not reps>0 — so that case is deliberately excluded here.)
    const { sessionId } = await makeSessionWithSets({
      sets: [
        { weight: 0, reps: 5 },
        { weight: 0, reps: 0 },
      ],
    });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 8000 });

    expect(found).toEqual([]);
    expect(await prs("ex_bench", "1rm")).toHaveLength(0);
    expect(await prs("ex_bench", "weight")).toHaveLength(0);
  });

  it("a 0-weight set still cannot set a weight PR (topWeight.weight > 0 guard)", async () => {
    // Only completed set is 0kg x 5 -> est1RM 0, weight 0. Nothing fires.
    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 0, reps: 5 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 8500 });
    expect(found).toEqual([]);
    expect(await prs("ex_bench", "weight")).toHaveLength(0);
  });

  it("only COMPLETED sets count: an uncompleted heavier set is ignored", async () => {
    const session = await startSession({ ownerId: OWNER_A, name: "W", now: 9000 });
    const se = await addSessionExercise({
      sessionId: session.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    // Completed: 100x5.
    const done = await logSet({ sessionExerciseId: se.id, order: 1, weight: 100, reps: 5 });
    // Uncompleted: 300x5 (would dominate both ledgers if counted).
    const undone = await addSet({ sessionExerciseId: se.id, order: 2, weight: 300, reps: 5 });

    const found = await detectAndRecordPRs({ sessionId: session.id, ownerId: OWNER_A, now: 9000 });

    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "1rm", value: round1rm(100, 5) });
    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "weight", value: 100 });
    expect((await prs("ex_bench", "weight"))[0]!.value).toBe(100); // not 300

    const [completedSet] = await setRow(done.id);
    const [uncompletedSet] = await setRow(undone.id);
    expect(completedSet!.isPr).toBe(true);
    expect(uncompletedSet!.isPr).toBe(false);
  });

  it("an exercise with no completed sets is skipped entirely", async () => {
    const session = await startSession({ ownerId: OWNER_A, name: "W", now: 9500 });
    const se = await addSessionExercise({
      sessionId: session.id,
      exerciseId: "ex_squat",
      order: 1,
    });
    await addSet({ sessionExerciseId: se.id, order: 1, weight: 200, reps: 5 }); // uncompleted

    const found = await detectAndRecordPRs({ sessionId: session.id, ownerId: OWNER_A, now: 9500 });
    expect(found).toEqual([]);
    expect(await prs("ex_squat", "1rm")).toHaveLength(0);
  });

  it("returns a DetectedPR[] that matches exactly what was written to the ledger", async () => {
    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 110, reps: 3 }] });
    const found = await detectAndRecordPRs({ sessionId, ownerId: OWNER_A, now: 10000 });

    const written1rm = await prs("ex_bench", "1rm");
    const writtenW = await prs("ex_bench", "weight");

    const foundMap = new Map(found.map((p) => [p.type, p.value]));
    expect(found).toHaveLength(2);
    expect(foundMap.get("1rm")).toBe(written1rm[0]!.value);
    expect(foundMap.get("weight")).toBe(writtenW[0]!.value);
    expect(written1rm[0]!.value).toBe(round1rm(110, 3));
    expect(writtenW[0]!.value).toBe(110);
  });

  it("records PRs per-exercise across multiple session exercises", async () => {
    const session = await startSession({ ownerId: OWNER_A, name: "W", now: 11000 });
    const benchSe = await addSessionExercise({
      sessionId: session.id,
      exerciseId: "ex_bench",
      order: 1,
    });
    const squatSe = await addSessionExercise({
      sessionId: session.id,
      exerciseId: "ex_squat",
      order: 2,
    });
    await logSet({ sessionExerciseId: benchSe.id, order: 1, weight: 100, reps: 5 });
    await logSet({ sessionExerciseId: squatSe.id, order: 1, weight: 140, reps: 5 });

    const found = await detectAndRecordPRs({ sessionId: session.id, ownerId: OWNER_A, now: 11000 });

    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "1rm", value: round1rm(100, 5) });
    expect(found).toContainEqual({ exerciseId: "ex_squat", type: "1rm", value: round1rm(140, 5) });
    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "weight", value: 100 });
    expect(found).toContainEqual({ exerciseId: "ex_squat", type: "weight", value: 140 });
    expect(await prs("ex_bench", "1rm")).toHaveLength(1);
    expect(await prs("ex_squat", "1rm")).toHaveLength(1);
  });
});
