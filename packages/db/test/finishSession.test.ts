import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { estimate1RM } from "@rackd/core";
import { db } from "../src/db";
import * as t from "../src/schema";
import { finishSession } from "../src/index";
import { makeSessionWithSets, OWNER_A } from "./factories";

const round1rm = (w: number, reps: number) => Math.round(estimate1RM(w, reps));

describe("finishSession (real Postgres)", () => {
  it("sets sessions.endedAt = now", async () => {
    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    await finishSession(sessionId, 12345);

    const [session] = await db.select().from(t.sessions).where(eq(t.sessions.id, sessionId)).limit(1);
    expect(session!.endedAt).toBe(12345);
  });

  it("returns DetectedPR[] — a fresh session with a strong set yields a PR", async () => {
    const { sessionId } = await makeSessionWithSets({ sets: [{ weight: 100, reps: 5 }] });
    const found = await finishSession(sessionId, 6000);

    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "1rm", value: round1rm(100, 5) });
    expect(found).toContainEqual({ exerciseId: "ex_bench", type: "weight", value: 100 });

    // PRs were actually written to the ledger.
    const ledger = await db
      .select()
      .from(t.personalRecords)
      .where(eq(t.personalRecords.exerciseId, "ex_bench"));
    expect(ledger).toHaveLength(2);
  });

  it("returns [] and does not throw for a missing session id", async () => {
    const found = await finishSession("does-not-exist", 7000);
    expect(found).toEqual([]);
    // No session row was conjured up.
    const rows = await db.select().from(t.sessions).where(eq(t.sessions.id, "does-not-exist"));
    expect(rows).toHaveLength(0);
  });

  it("returns [] when the session has no completed sets (nothing to PR)", async () => {
    // A finished session whose only set is 0kg x 0 -> estimate1RM 0, weight 0.
    const { sessionId } = await makeSessionWithSets({
      ownerId: OWNER_A,
      sets: [{ weight: 0, reps: 0 }],
    });
    const found = await finishSession(sessionId, 8000);
    expect(found).toEqual([]);

    const [session] = await db.select().from(t.sessions).where(eq(t.sessions.id, sessionId)).limit(1);
    expect(session!.endedAt).toBe(8000); // still marked finished
  });
});
