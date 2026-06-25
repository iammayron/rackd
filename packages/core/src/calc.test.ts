import { describe, expect, it } from "vitest";
import {
  estimate1RM,
  plateBreakdown,
  nextWeight,
  sessionVolume,
  warmupSets,
  todaysRoutine,
  suggestReplacements,
  currentStreak,
  weekStartIndex,
  programTodaySlot,
  programNextSlot,
  advanceRotation,
  diffSessionVsRoutine,
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
  it("is 0 for no sets", () => {
    expect(sessionVolume([])).toBe(0);
  });
  it("is 0 when nothing is completed", () => {
    const sets = [
      { weight: 80, reps: 8, completed: false },
      { weight: 80, reps: 8, completed: false },
    ] as SetLog[];
    expect(sessionVolume(sets)).toBe(0);
  });
  it("sums weight x reps across many completed sets", () => {
    const sets = [
      { weight: 100, reps: 5, completed: true }, // 500
      { weight: 60, reps: 10, completed: true }, // 600
      { weight: 40, reps: 12, completed: true }, // 480
    ] as SetLog[];
    expect(sessionVolume(sets)).toBe(1580);
  });
});

describe("weekly volume & count", () => {
  // Mirrors WeeklyVolumeCard: weekStartIndex picks this week's Monday; sessions
  // whose day index is >= that are "this week"; volume = sessionVolume of their
  // completed sets, count = number of this-week sessions.
  const monday = weekStartIndex(100, 4); // today Thu (index 100) → Monday is 97
  const sessions = [
    { dayIndex: 97, sets: [{ weight: 100, reps: 5, completed: true }] }, // Mon, this week
    { dayIndex: 100, sets: [{ weight: 60, reps: 10, completed: true }] }, // Thu, this week
    { dayIndex: 96, sets: [{ weight: 50, reps: 10, completed: true }] }, // last Sun, prior week
  ];
  const thisWeek = sessions.filter((s) => s.dayIndex >= monday);

  it("includes only sessions on/after this week's Monday", () => {
    expect(thisWeek.map((s) => s.dayIndex)).toEqual([97, 100]);
  });
  it("counts this-week workouts", () => {
    expect(thisWeek.length).toBe(2);
  });
  it("sums this-week volume only", () => {
    const sets = thisWeek.flatMap((s) => s.sets) as SetLog[];
    expect(sessionVolume(sets)).toBe(500 + 600);
  });
});

describe("units", () => {
  it("round-trips kg/lb", () => {
    expect(fromKg(toKg(100, "lb"), "lb")).toBeCloseTo(100, 6);
  });
  it("formats", () => {
    expect(formatWeight(100, "kg")).toBe("100 kg");
  });
  it("passes kg through unchanged at the edge", () => {
    expect(toKg(100, "kg")).toBe(100);
    expect(fromKg(100, "kg")).toBe(100);
  });
  it("converts lb to canonical kg", () => {
    expect(toKg(100, "lb")).toBeCloseTo(45.359237, 6);
  });
  it("converts canonical kg back to lb for display", () => {
    expect(fromKg(45.359237, "lb")).toBeCloseTo(100, 6);
  });
  it("rounds at the display edge to the requested decimals", () => {
    expect(formatWeight(45.359237, "lb", 0)).toBe("100 lb");
    expect(formatWeight(100, "lb", 1)).toBe("220.5 lb");
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

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak([100, 99, 98], 100)).toBe(3);
  });
  it("counts from yesterday when today has no workout", () => {
    expect(currentStreak([99, 98], 100)).toBe(2);
  });
  it("is 0 when the latest workout predates yesterday", () => {
    expect(currentStreak([98, 97], 100)).toBe(0);
  });
  it("stops at the first gap", () => {
    expect(currentStreak([100, 99, 97, 96], 100)).toBe(2);
  });
  it("is 0 with no workouts", () => {
    expect(currentStreak([], 100)).toBe(0);
  });
  it("dedupes multiple workouts on the same day", () => {
    expect(currentStreak([100, 100, 99], 100)).toBe(2);
  });
});

describe("weekStartIndex", () => {
  it("returns today's index when today is Monday", () => {
    expect(weekStartIndex(100, 1)).toBe(100); // Monday
  });
  it("backs up to the most recent Monday mid-week", () => {
    expect(weekStartIndex(100, 4)).toBe(97); // Thursday → 3 days back
  });
  it("treats Sunday as the last day of the week (6 days back)", () => {
    expect(weekStartIndex(100, 0)).toBe(94); // Sunday → Monday is 6 days earlier
  });
});

describe("programTodaySlot", () => {
  const weekly = [
    { order: 0, weekday: 1, routineId: "push" },
    { order: 1, weekday: 3, routineId: "legs" },
    { order: 2, weekday: 5, routineId: undefined }, // Fri rest
  ];
  it("weekly: returns the day pinned to today's weekday", () => {
    expect(programTodaySlot(weekly, "weekly", 0, 1)?.routineId).toBe("push");
  });
  it("weekly: null on an unscheduled weekday", () => {
    expect(programTodaySlot(weekly, "weekly", 0, 2)).toBeNull();
  });
  it("weekly: null when the matched day is a rest day", () => {
    expect(programTodaySlot(weekly, "weekly", 0, 5)).toBeNull();
  });

  const rot = [
    { order: 0, routineId: "push" },
    { order: 1, routineId: "pull" },
    { order: 2, routineId: undefined }, // rest
  ];
  it("rotation: returns the day at the cursor", () => {
    expect(programTodaySlot(rot, "rotation", 1, 0)?.routineId).toBe("pull");
  });
  it("rotation: null when the cursor lands on a rest day", () => {
    expect(programTodaySlot(rot, "rotation", 2, 0)).toBeNull();
  });
  it("rotation: cursor wraps past the end", () => {
    expect(programTodaySlot(rot, "rotation", 3, 0)?.routineId).toBe("push");
  });
  it("returns null for an empty program", () => {
    expect(programTodaySlot([], "rotation", 0, 0)).toBeNull();
  });
});

describe("programNextSlot", () => {
  const weekly = [
    { order: 0, weekday: 1, routineId: "push" },
    { order: 1, weekday: 4, routineId: "legs" },
  ];
  it("weekly: finds the next training weekday, skipping rest", () => {
    expect(programNextSlot(weekly, "weekly", 0, 1)?.routineId).toBe("legs");
  });
  it("weekly: wraps around the week back to the first day", () => {
    expect(programNextSlot(weekly, "weekly", 0, 4)?.routineId).toBe("push");
  });
  it("weekly: falls back to the first ordered workout when no day is weekday-pinned", () => {
    // A weekly program created in rotation (days carry only `order`, no
    // weekday) — every day reads as rest "today", but skip-rest still offers
    // the first scheduled workout in order.
    const noWeekday = [
      { order: 2, routineId: "pull" },
      { order: 1, routineId: "push" },
      { order: 3, routineId: "legs" },
    ];
    expect(programNextSlot(noWeekday, "weekly", 0, 3)?.routineId).toBe("push");
  });
  it("weekly: returns null when no day is weekday-pinned and every day is rest", () => {
    const allRest = [{ order: 1 }, { order: 2 }];
    expect(programNextSlot(allRest, "weekly", 0, 3)).toBeNull();
  });

  const rot = [
    { order: 0, routineId: "push" },
    { order: 1, routineId: undefined }, // rest
    { order: 2, routineId: "legs" },
  ];
  it("rotation: skips rest days to the next workout", () => {
    expect(programNextSlot(rot, "rotation", 0, 0)?.routineId).toBe("legs");
  });
  it("rotation: wraps to the first workout", () => {
    expect(programNextSlot(rot, "rotation", 2, 0)?.routineId).toBe("push");
  });
  it("returns null when every day is rest", () => {
    expect(programNextSlot([{ order: 0 }], "rotation", 0, 0)).toBeNull();
  });
});

describe("advanceRotation", () => {
  it("steps to the next index", () => {
    expect(advanceRotation(0, 4)).toBe(1);
  });
  it("wraps at the end", () => {
    expect(advanceRotation(3, 4)).toBe(0);
  });
  it("is safe for a zero-day program", () => {
    expect(advanceRotation(0, 0)).toBe(0);
  });
});

describe("diffSessionVsRoutine", () => {
  const presc = [
    { exerciseId: "a", sets: [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }] },
    { exerciseId: "b", sets: [{ weight: 50, reps: 10 }] },
  ];

  it("reports no change when performed matches the plan", () => {
    expect(diffSessionVsRoutine(presc, presc)).toEqual({
      exercisesChanged: false,
      numbersChanged: false,
    });
  });

  it("flags numbersChanged when a weight differs", () => {
    const performed = [
      { exerciseId: "a", sets: [{ weight: 102.5, reps: 8 }, { weight: 100, reps: 8 }] },
      { exerciseId: "b", sets: [{ weight: 50, reps: 10 }] },
    ];
    expect(diffSessionVsRoutine(presc, performed)).toEqual({
      exercisesChanged: false,
      numbersChanged: true,
    });
  });

  it("flags numbersChanged when set count differs", () => {
    const performed = [
      { exerciseId: "a", sets: [{ weight: 100, reps: 8 }] },
      { exerciseId: "b", sets: [{ weight: 50, reps: 10 }] },
    ];
    expect(diffSessionVsRoutine(presc, performed).numbersChanged).toBe(true);
  });

  it("flags exercisesChanged on a swapped/added exercise (new exercise alone is not a number change)", () => {
    const performed = [
      { exerciseId: "a", sets: [{ weight: 100, reps: 8 }, { weight: 100, reps: 8 }] },
      { exerciseId: "b", sets: [{ weight: 50, reps: 10 }] },
      { exerciseId: "c", sets: [{ weight: 30, reps: 12 }] },
    ];
    expect(diffSessionVsRoutine(presc, performed)).toEqual({
      exercisesChanged: true,
      numbersChanged: false,
    });
  });

  it("flags exercisesChanged on reorder", () => {
    const performed = [presc[1]!, presc[0]!];
    expect(diffSessionVsRoutine(presc, performed).exercisesChanged).toBe(true);
  });

  it("treats missing weight/reps as zero", () => {
    const p = [{ exerciseId: "a", sets: [{ reps: 8 }] }];
    const q = [{ exerciseId: "a", sets: [{ weight: 0, reps: 8 }] }];
    expect(diffSessionVsRoutine(p, q).numbersChanged).toBe(false);
  });
});
