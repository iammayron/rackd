import { describe, expect, it } from "vitest";
import { copyTargets } from "@/features/active-workout/copy-targets";

// The real display edge: canonical kg → lb, rounded to one decimal.
const KG_PER_LB = 0.45359237;
const displayLb = (kg: number) => Number((kg / KG_PER_LB).toFixed(1));
const displayKg = (kg: number) => Number(kg.toFixed(1));

const set = (order: number, weight: number, reps: number, completed = false) => ({
  order,
  weight,
  reps,
  completed,
});

describe("copyTargets", () => {
  it("offers the later sets that differ", () => {
    const done = set(1, 100, 12);
    const sets = [done, set(2, 80, 12), set(3, 80, 10)];
    expect(copyTargets(sets, done, displayKg).map((s) => s.order)).toEqual([2, 3]);
  });

  it("offers nothing when the later sets already match exactly", () => {
    const done = set(1, 100, 12);
    const sets = [done, set(2, 100, 12), set(3, 100, 12)];
    expect(copyTargets(sets, done, displayKg)).toEqual([]);
  });

  it("offers nothing when the sets read the same on screen but differ in stored kg", () => {
    // The reported bug. 42.5 kg shows as 93.7 lb; ticking a set used to push the
    // rounded 93.7 back through the conversion and store 42.5019… Raw-kg
    // comparison then saw a difference and prompted to copy 93.7 onto 93.7.
    const drifted = 42.5 / KG_PER_LB;
    const restored = Number(drifted.toFixed(1)) * KG_PER_LB;
    expect(restored).not.toBe(42.5); // the round-trip really is lossy
    expect(displayLb(restored)).toBe(displayLb(42.5)); // …but identical on screen

    const done = set(1, restored, 12);
    const sets = [done, set(2, 42.5, 12), set(3, 42.5, 12)];
    expect(copyTargets(sets, done, displayLb)).toEqual([]);
  });

  it("still offers a set whose weight differs visibly", () => {
    const done = set(1, 42.5, 12);
    const sets = [done, set(2, 45, 12)];
    expect(copyTargets(sets, done, displayLb).map((s) => s.order)).toEqual([2]);
  });

  it("offers a set whose reps differ even when the weight matches", () => {
    const done = set(1, 100, 12);
    const sets = [done, set(2, 100, 8)];
    expect(copyTargets(sets, done, displayKg).map((s) => s.order)).toEqual([2]);
  });

  it("skips sets that are already completed", () => {
    const done = set(1, 100, 12);
    const sets = [done, set(2, 80, 12, true), set(3, 80, 12)];
    expect(copyTargets(sets, done, displayKg).map((s) => s.order)).toEqual([3]);
  });

  it("never offers earlier sets, nor the completed set itself", () => {
    const done = set(2, 100, 12);
    const sets = [set(1, 60, 12), done, set(3, 60, 12)];
    expect(copyTargets(sets, done, displayKg).map((s) => s.order)).toEqual([3]);
  });

  it("offers nothing when the completed set is the last one", () => {
    const done = set(3, 100, 12);
    expect(copyTargets([set(1, 60, 12), set(2, 60, 12), done], done, displayKg)).toEqual([]);
  });

  it("treats a rounding difference below display precision as a match in kg too", () => {
    const done = set(1, 42.5, 12);
    const sets = [done, set(2, 42.53, 12)]; // both render "42.5 kg"
    expect(copyTargets(sets, done, displayKg)).toEqual([]);
  });
});
