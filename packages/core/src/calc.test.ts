import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  plateBreakdown,
  nextWeight,
  sessionVolume,
  warmupSets,
  todaysRoutine,
  suggestReplacements,
} from "./calc";
import { toKg, fromKg, formatWeight } from "./units";
import { startTimer, pauseTimer, resumeTimer, remainingMs, addTime } from "./timer";
import type { SetLog } from "./types";

describe("estimate1RM", () => {
  it("returns the weight for a single rep", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });
  it("applies Epley for multiple reps", () => {
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
  });
  it("guards invalid input", () => {
    expect(estimate1RM(0, 5)).toBe(0);
    expect(estimate1RM(100, 0)).toBe(0);
  });
});

describe("plateBreakdown", () => {
  it("splits per side and tracks leftover", () => {
    const r = plateBreakdown(100, 20);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.leftover).toBe(0);
  });
  it("reports unreachable remainder", () => {
    const r = plateBreakdown(101, 20);
    expect(r.leftover).toBeGreaterThan(0);
  });
});

describe("nextWeight", () => {
  it("double progression bumps only at top of range", () => {
    expect(nextWeight(60, 8, 8)).toBe(62.5);
    expect(nextWeight(60, 6, 8)).toBe(60);
  });
  it("linear always adds increment", () => {
    expect(nextWeight(60, 5, 8, "linear")).toBe(62.5);
  });
});

describe("warmupSets", () => {
  it("ramps to the working weight, rounded to plate step", () => {
    const w = warmupSets(100, 20);
    expect(w.map((s) => s.weight)).toEqual([20, 40, 60, 80]);
    expect(w.every((s) => s.weight < 100)).toBe(true);
  });
  it("returns none when working weight <= bar", () => {
    expect(warmupSets(20, 20)).toEqual([]);
    expect(warmupSets(15, 20)).toEqual([]);
  });
  it("drops ramp sets that meet/exceed the working weight", () => {
    const w = warmupSets(30, 20);
    expect(w.every((s) => s.weight < 30)).toBe(true);
  });
});

describe("sessionVolume", () => {
  it("sums completed sets only", () => {
    const sets = [
      { weight: 100, reps: 5, completed: true },
      { weight: 100, reps: 5, completed: false },
    ] as SetLog[];
    expect(sessionVolume(sets)).toBe(500);
  });
});

describe("units", () => {
  it("round-trips kg/lb", () => {
    expect(fromKg(toKg(100, "lb"), "lb")).toBeCloseTo(100, 6);
  });
  it("formats", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg");
  });
});

describe("timer FSM", () => {
  it("counts down by wall clock", () => {
    const t0 = 1_000_000;
    const t = startTimer(90, t0);
    expect(remainingMs(t, t0)).toBe(90_000);
    expect(remainingMs(t, t0 + 30_000)).toBe(60_000);
  });
  it("pause/resume preserves remaining", () => {
    const t0 = 0;
    let t = startTimer(90, t0);
    t = pauseTimer(t, 30_000);
    expect(remainingMs(t, 999_999)).toBe(60_000);
    t = resumeTimer(t, 100_000);
    expect(remainingMs(t, 130_000)).toBe(30_000);
  });
  it("addTime extends", () => {
    let t = startTimer(60, 0);
    t = addTime(t, 15);
    expect(remainingMs(t, 0)).toBe(75_000);
  });
});

describe("todaysRoutine", () => {
  const push = { order: 0, scheduledDays: [1, 4], name: "Push" }; // Mon, Thu
  const pull = { order: 1, scheduledDays: [2, 5], name: "Pull" }; // Tue, Fri
  const legs = { order: 2, scheduledDays: [1], name: "Legs" }; // also Mon

  it("returns the routine scheduled for the weekday", () => {
    expect(todaysRoutine([push, pull, legs], 2)?.name).toBe("Pull");
  });
  it("picks the lowest-order routine when several share the day", () => {
    expect(todaysRoutine([legs, push, pull], 1)?.name).toBe("Push");
  });
  it("returns undefined when nothing is scheduled today", () => {
    expect(todaysRoutine([push, pull, legs], 0)).toBeUndefined();
  });
  it("ignores routines with no schedule", () => {
    expect(todaysRoutine([{ order: 0, name: "Any" }], 3)).toBeUndefined();
  });
});

describe("suggestReplacements", () => {
  const bench = { id: "a", name: "Bench Press", primaryMuscle: "chest", equipment: "barbell" };
  const dbPress = { id: "b", name: "Dumbbell Press", primaryMuscle: "chest", equipment: "dumbbell" };
  const fly = { id: "c", name: "Cable Fly", primaryMuscle: "chest", equipment: "cable" };
  const row = { id: "d", name: "Barbell Row", primaryMuscle: "back", equipment: "barbell" };
  const squat = { id: "e", name: "Squat", primaryMuscle: "legs", equipment: "machine" };
  const lib = [bench, dbPress, fly, row, squat];

  it("excludes the exercise itself", () => {
    expect(suggestReplacements(lib, bench).map((e) => e.id)).not.toContain("a");
  });
  it("includes same-muscle and same-equipment matches", () => {
    const ids = suggestReplacements(lib, bench).map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["b", "c", "d"]));
    expect(ids).not.toContain("e"); // no shared muscle or equipment
  });
  it("ranks a both-match above a single-match", () => {
    // chest match (db, fly) score 2; barbell match (row) score 1 → chest first
    expect(suggestReplacements(lib, bench)[2]?.id).toBe("d");
  });
  it("returns empty when nothing matches", () => {
    expect(suggestReplacements([bench], bench)).toEqual([]);
  });
});
