import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import * as t from "../src/schema";
import { createProgram, setProgramActive } from "../src/index";
import { OWNER_A, OWNER_B } from "./factories";

const persistedActive = async (id: string) => {
  const [row] = await db.select().from(t.programs).where(eq(t.programs.id, id));
  return row!.active;
};

const persistedActivatedAt = async (id: string) => {
  const [row] = await db.select().from(t.programs).where(eq(t.programs.id, id));
  return row!.activatedAt;
};

describe("programs — auto-activate + single-active", () => {
  it("auto-activates the FIRST program for an owner", async () => {
    const first = await createProgram({ ownerId: OWNER_A, name: "P1" });
    expect(first.active).toBe(true);
    expect(await persistedActive(first.id)).toBe(true);
  });

  it("does NOT auto-activate a second program for the same owner", async () => {
    await createProgram({ ownerId: OWNER_A, name: "P1" });
    const second = await createProgram({ ownerId: OWNER_A, name: "P2" });
    // Returned object's active matches what's persisted.
    expect(second.active).toBeFalsy();
    expect(await persistedActive(second.id)).toBeFalsy();
  });

  it("auto-activate is owner-scoped", async () => {
    // Owner A already has programs; owner B's first still activates.
    await createProgram({ ownerId: OWNER_A, name: "A1" });
    await createProgram({ ownerId: OWNER_A, name: "A2" });
    const bFirst = await createProgram({ ownerId: OWNER_B, name: "B1" });
    expect(bFirst.active).toBe(true);
    expect(await persistedActive(bFirst.id)).toBe(true);
  });

  it("setProgramActive enforces single-active within an owner", async () => {
    const p1 = await createProgram({ ownerId: OWNER_A, name: "P1" }); // auto-active
    const p2 = await createProgram({ ownerId: OWNER_A, name: "P2" });
    const p3 = await createProgram({ ownerId: OWNER_A, name: "P3" });

    await setProgramActive({ programId: p2.id, ownerId: OWNER_A });

    expect(await persistedActive(p1.id)).toBeFalsy();
    expect(await persistedActive(p2.id)).toBe(true);
    expect(await persistedActive(p3.id)).toBeFalsy();
  });

  it("setProgramActive does not touch another owner's active program", async () => {
    const a1 = await createProgram({ ownerId: OWNER_A, name: "A1" }); // A's active
    const b1 = await createProgram({ ownerId: OWNER_B, name: "B1" }); // B's active
    const b2 = await createProgram({ ownerId: OWNER_B, name: "B2" });

    await setProgramActive({ programId: b2.id, ownerId: OWNER_B });

    // A's program untouched; B's flipped to b2.
    expect(await persistedActive(a1.id)).toBe(true);
    expect(await persistedActive(b1.id)).toBeFalsy();
    expect(await persistedActive(b2.id)).toBe(true);
  });

  it("re-activating the already-active program leaves it active", async () => {
    const p1 = await createProgram({ ownerId: OWNER_A, name: "P1" });
    await setProgramActive({ programId: p1.id, ownerId: OWNER_A });
    expect(await persistedActive(p1.id)).toBe(true);
  });
});

describe("programs — activatedAt anchors the week-block bar", () => {
  it("stamps activatedAt when the first program auto-activates", async () => {
    const before = Date.now();
    const first = await createProgram({ ownerId: OWNER_A, name: "P1" });
    const stamped = await persistedActivatedAt(first.id);
    expect(stamped).not.toBeNull();
    expect(stamped!).toBeGreaterThanOrEqual(before);
    expect(stamped!).toBeLessThanOrEqual(Date.now());
    // Returned object mirrors the persisted stamp.
    expect(first.activatedAt).toBe(stamped);
  });

  it("leaves activatedAt null for a non-auto-activated program", async () => {
    await createProgram({ ownerId: OWNER_A, name: "P1" });
    const second = await createProgram({ ownerId: OWNER_A, name: "P2" });
    expect(await persistedActivatedAt(second.id)).toBeNull();
  });

  it("stamps activatedAt on the program turned active", async () => {
    await createProgram({ ownerId: OWNER_A, name: "P1" }); // auto-active
    const p2 = await createProgram({ ownerId: OWNER_A, name: "P2" });
    expect(await persistedActivatedAt(p2.id)).toBeNull();

    const at = 1_700_000_000_000;
    await setProgramActive({ programId: p2.id, ownerId: OWNER_A, now: at });

    expect(await persistedActive(p2.id)).toBe(true);
    expect(await persistedActivatedAt(p2.id)).toBe(at);
  });

  it("does NOT re-stamp activatedAt when re-activating an already-active program", async () => {
    const p1 = await createProgram({ ownerId: OWNER_A, name: "P1" }); // auto-active
    const original = await persistedActivatedAt(p1.id);
    expect(original).not.toBeNull();

    // Re-activating the live program is a no-op — the week-1 anchor must hold.
    await setProgramActive({
      programId: p1.id,
      ownerId: OWNER_A,
      now: original! + 999_999,
    });

    expect(await persistedActivatedAt(p1.id)).toBe(original);
  });
});
