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
  daysAway,
  firstWorkoutSlot,
  shouldRestartRotation,
  LAYOFF_RESTART_DAYS,
  diffSessionVsRoutine,
  programWeekProgress,
  programCurrentWeek,
  programDayKinds,
  programRotationDayKinds,
  sessionCountsForProgram,
  estimateSessionMinutes,
  BAR_WEIGHTS,
} from "./calc";
import type { ProgramDayKind } from "./calc";
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

describe("estimateSessionMinutes", () => {
  it("returns 0 for an empty routine", () => {
    expect(estimateSessionMinutes([])).toBe(0);
  });

  it("sums work + rest across exercises and rounds to nearest 5", () => {
    // bench: 3*(40+90)=390, squat: 4*(40+180)=880, row: 3*(40+120)=480
    // total 1750s = 29.166min -> round(29.166/5)*5 = 30
    expect(
      estimateSessionMinutes([
        { setCount: 3, restSec: 90 },
        { setCount: 4, restSec: 180 },
        { setCount: 3 },
      ]),
    ).toBe(30);
  });

  it("falls back to the 120s default rest when restSec is omitted", () => {
    // both are 3*(40+120)=480s -> 8min -> 10
    expect(estimateSessionMinutes([{ setCount: 3 }])).toBe(
      estimateSessionMinutes([{ setCount: 3, restSec: 120 }]),
    );
    expect(estimateSessionMinutes([{ setCount: 3 }])).toBe(10);
  });

  it("respects an explicit restSec over the default", () => {
    // 5*(40+200)=1200s = exactly 20min
    expect(estimateSessionMinutes([{ setCount: 5, restSec: 200 }])).toBe(20);
  });

  it("never drops below the roundTo floor for a non-empty routine", () => {
    // 1*(40+0)=40s -> round(0.66/5)*5=0, floored to 5
    expect(estimateSessionMinutes([{ setCount: 1, restSec: 0 }])).toBe(5);
  });

  it("always yields a multiple of the rounding step", () => {
    for (const sets of [1, 2, 3, 5, 7, 11]) {
      expect(estimateSessionMinutes([{ setCount: sets }]) % 5).toBe(0);
    }
  });

  it("honors a custom roundTo argument", () => {
    // 5*(40+120)=800s = 13.333min; roundTo 10 -> round(1.333)*10 = 10
    expect(estimateSessionMinutes([{ setCount: 5 }], 10)).toBe(10);
    // same input at the default step of 5 -> round(2.666)*5 = 15
    expect(estimateSessionMinutes([{ setCount: 5 }])).toBe(15);
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
  it("decomposes against a non-standard (lighter) bar", () => {
    // 15 kg women's bar: (60 - 15) / 2 = 22.5 per side → 20 + 2.5
    const r = plateBreakdown(60, 15);
    expect(r.perSide).toEqual([20, 2.5]);
    expect(r.leftover).toBe(0);
  });
  it("flags the leftover when a per-side target isn't reachable on a heavy bar", () => {
    // 25 kg trap bar: (61 - 25) / 2 = 18 per side → 15 + 2.5 = 17.5, 0.5 short
    const r = plateBreakdown(61, 25);
    expect(r.perSide).toEqual([15, 2.5]);
    expect(r.leftover).toBeCloseTo(1, 5); // 0.5 per side × 2
  });
  it("returns bar-only (empty per side) when target equals the bar", () => {
    const r = plateBreakdown(25, 25);
    expect(r.perSide).toEqual([]);
    expect(r.leftover).toBe(0);
  });
});

describe("BAR_WEIGHTS", () => {
  it("keeps clean per-unit standards (20 kg is not the 45 lb of the same bar)", () => {
    expect(BAR_WEIGHTS.standard).toEqual({ kg: 20, lb: 45 });
    expect(BAR_WEIGHTS.womens).toEqual({ kg: 15, lb: 35 });
  });
  it("drives warmups off the chosen bar (empty-bar set uses the lighter bar)", () => {
    const w = warmupSets(60, BAR_WEIGHTS.womens.kg); // 15 kg bar
    expect(w[0]!.weight).toBe(15);
    expect(w.every((s) => s.weight < 60)).toBe(true);
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

  it("boosts a shared movement pattern above equipment-only", () => {
    const target = { id: "t", name: "Barbell Row", primaryMuscle: "back", equipment: "barbell", movementPattern: "pull" };
    const pulldown = { id: "p", name: "Lat Pulldown", primaryMuscle: "back", equipment: "cable", movementPattern: "pull" };
    const benchBb = { id: "b", name: "Bench Press", primaryMuscle: "chest", equipment: "barbell", movementPattern: "push" };
    const ranked = suggestReplacements([pulldown, benchBb], target).map((e) => e.id);
    // pulldown: primary(2)+pattern(2)=4; bench: equipment(1) → pulldown first
    expect(ranked[0]).toBe("p");
  });

  it("rewards shared secondary muscles", () => {
    const target = { id: "t", name: "Pull-Up", primaryMuscle: "back", equipment: "bodyweight", secondaryMuscles: ["biceps"] };
    const chin = { id: "c", name: "Chin-Up", primaryMuscle: "back", equipment: "bodyweight", secondaryMuscles: ["biceps"] };
    const rack = { id: "r", name: "Rack Pull", primaryMuscle: "back", equipment: "barbell", secondaryMuscles: ["traps"] };
    // chin: primary(2)+equip(1)+secondary(1)=4; rack: primary(2) → chin first
    expect(suggestReplacements([rack, chin], target)[0]?.id).toBe("c");
  });

  it("caps the secondary-overlap bonus at 2", () => {
    // Both share the primary muscle; one shares 3 secondaries, the other 2. The
    // cap makes the secondary bonus tie (2 each), so equipment breaks it: the
    // barbell match wins. If the cap were removed (3 > 2), `three` would win.
    const target = { id: "t", name: "T", primaryMuscle: "back", equipment: "barbell", secondaryMuscles: ["biceps", "traps", "forearms"] };
    const three = { id: "x3", name: "Three", primaryMuscle: "back", equipment: "cable", secondaryMuscles: ["biceps", "traps", "forearms"] };
    const twoBarbell = { id: "x2", name: "Two", primaryMuscle: "back", equipment: "barbell", secondaryMuscles: ["biceps", "traps"] };
    // three: primary(2)+secondary(min(3,2)=2)=4; twoBarbell: primary(2)+equip(1)+secondary(2)=5
    expect(suggestReplacements([three, twoBarbell], target)[0]?.id).toBe("x2");
  });

  it("breaks a tie on shared mechanic", () => {
    const target = { id: "t", name: "T", primaryMuscle: "chest", equipment: "barbell", mechanic: "compound" };
    const compound = { id: "co", name: "Compound", primaryMuscle: "chest", equipment: "dumbbell", mechanic: "compound" };
    const isolation = { id: "is", name: "Isolation", primaryMuscle: "chest", equipment: "dumbbell", mechanic: "isolation" };
    // compound: primary(2)+mechanic(1)=3; isolation: primary(2)=2 → compound first
    expect(suggestReplacements([isolation, compound], target)[0]?.id).toBe("co");
  });

  it("does not award pattern bonus when only one side defines it", () => {
    // target has a movementPattern, candidate has none → no +2; the candidate
    // that merely matches equipment must not be out-ranked by a phantom bonus.
    const target = { id: "t", name: "Row", primaryMuscle: "back", equipment: "cable", movementPattern: "pull" };
    const noPattern = { id: "np", name: "No Pattern", primaryMuscle: "back", equipment: "cable" };
    // noPattern: primary(2)+equip(1)=3, pattern guarded off (undefined !== "pull")
    expect(suggestReplacements([noPattern], target)[0]?.id).toBe("np");
    // sanity: the only candidate still scores > 0 and is returned
    expect(suggestReplacements([noPattern], target)).toHaveLength(1);
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

describe("programWeekProgress", () => {
  const fill = (n: number, k: ProgramDayKind): ProgramDayKind[] =>
    Array.from({ length: n }, () => k);

  it("ignites a week only when all 7 notches fill (done + rest)", () => {
    // Week 1: 4 workouts done + 3 rest = full → fire. Week 2: all future.
    const week1: ProgramDayKind[] = [
      "done", "rest", "done", "rest", "done", "rest", "done",
    ];
    const r = programWeekProgress(2, [...week1, ...fill(7, "future")]);
    expect(r.totalDays).toBe(14);
    expect(r.filledDays).toBe(7);
    expect(r.weekFill).toEqual([1, 0]);
    expect(r.weekDone).toEqual([true, false]);
    expect(r.completedWeeks).toBe(1);
  });

  it("holds the fire when a workout is missed (gap stays empty)", () => {
    const week1: ProgramDayKind[] = [
      "done", "rest", "missed", "rest", "done", "rest", "done",
    ];
    const r = programWeekProgress(1, week1);
    expect(r.filledDays).toBe(6);
    expect(r.weekDone).toEqual([false]);
    expect(r.weekFill[0]).toBeCloseTo(6 / 7, 5);
    expect(r.completedWeeks).toBe(0);
  });

  it("counts pending/missed/future as empty", () => {
    const r = programWeekProgress(1, [
      "done", "pending", "future", "future", "future", "future", "future",
    ]);
    expect(r.filledDays).toBe(1);
    expect(r.weekFill[0]).toBeCloseTo(1 / 7, 5);
  });

  it("pads short dayKinds arrays as future", () => {
    const r = programWeekProgress(3, ["done", "rest"]);
    expect(r.totalDays).toBe(21);
    expect(r.filledDays).toBe(2);
    expect(r.weekDone).toEqual([false, false, false]);
  });

  it("returns an empty block for zero/negative weeks", () => {
    const r = programWeekProgress(0, []);
    expect(r).toEqual({
      blockWeeks: 0,
      totalDays: 0,
      filledDays: 0,
      weekFill: [],
      weekDone: [],
      completedWeeks: 0,
    });
  });

  it("ignites every week of a fully-completed block", () => {
    const r = programWeekProgress(4, fill(28, "rest"));
    expect(r.completedWeeks).toBe(4);
    expect(r.weekDone).toEqual([true, true, true, true]);
    expect(r.filledDays).toBe(28);
  });

  it("tracks a partially-filled second week without bleeding into week 1", () => {
    // Week 1 full (7), week 2 has 3 filled — guards the `w * 7 + d` indexing.
    const dayKinds: ProgramDayKind[] = [
      ...fill(7, "rest"),
      "done", "rest", "done", "missed", "pending", "future", "future",
    ];
    const r = programWeekProgress(2, dayKinds);
    expect(r.filledDays).toBe(10);
    expect(r.weekFill[0]).toBe(1);
    expect(r.weekFill[1]).toBeCloseTo(3 / 7, 5);
    expect(r.weekDone).toEqual([true, false]);
    expect(r.completedWeeks).toBe(1);
  });

  it("caps at totalDays and ignores dayKinds beyond the block", () => {
    const r = programWeekProgress(1, fill(20, "done")); // far more than 7
    expect(r.totalDays).toBe(7);
    expect(r.filledDays).toBe(7);
    expect(r.weekFill).toEqual([1]);
  });

  it("floors a fractional blockWeeks", () => {
    const r = programWeekProgress(2.9, fill(14, "rest"));
    expect(r.blockWeeks).toBe(2);
    expect(r.totalDays).toBe(14);
    expect(r.completedWeeks).toBe(2);
  });

  it("returns an empty block for negative weeks", () => {
    const r = programWeekProgress(-3, fill(10, "done"));
    expect(r.totalDays).toBe(0);
    expect(r.weekFill).toEqual([]);
    expect(r.completedWeeks).toBe(0);
  });
});

describe("programDayKinds", () => {
  it("classifies a weekly schedule (done/rest/future) by weekday", () => {
    // Anchor Mon; workouts Mon/Wed/Fri. Today is day 3 (Thu); Mon & Wed done.
    const kinds = programDayKinds({
      blockWeeks: 1,
      anchorWeekday: 1, // Mon
      todayOffset: 3,
      completedOffsets: [0, 2],
      schedule: { workoutWeekdays: [1, 3, 5] },
    });
    expect(kinds).toEqual([
      "done", "rest", "done", "rest", "future", "future", "future",
    ]);
  });

  it("marks a past uncompleted workout as missed and today's as pending", () => {
    // Anchor Mon; workouts Mon/Wed/Fri. Today is Fri (day 4); only Mon done.
    const kinds = programDayKinds({
      blockWeeks: 1,
      anchorWeekday: 1,
      todayOffset: 4,
      completedOffsets: [0],
      schedule: { workoutWeekdays: [1, 3, 5] },
    });
    expect(kinds).toEqual([
      "done", "rest", "missed", "rest", "pending", "future", "future",
    ]);
  });

  it("wraps weekday math when the anchor is late in the week", () => {
    // Anchor Sat; only Sun is a workout day → day 1 (Sun) is the workout.
    const kinds = programDayKinds({
      blockWeeks: 1,
      anchorWeekday: 6, // Sat
      todayOffset: 6,
      completedOffsets: [1],
      schedule: { workoutWeekdays: [0] },
    });
    expect(kinds).toEqual([
      "rest", "done", "rest", "rest", "rest", "rest", "rest",
    ]);
  });

  it("counts a workout completed on a rest day as done", () => {
    // Only Mon is a workout day; a session was logged on day 1 (a rest day).
    const kinds = programDayKinds({
      blockWeeks: 1,
      anchorWeekday: 1,
      todayOffset: 1,
      completedOffsets: [1],
      schedule: { workoutWeekdays: [1] },
    });
    expect(kinds[0]).toBe("missed"); // Mon workout not done
    expect(kinds[1]).toBe("done"); // logged on the rest day → done
  });

  it("returns an empty array for a zero-week block", () => {
    expect(
      programDayKinds({
        blockWeeks: 0,
        anchorWeekday: 0,
        todayOffset: 0,
        completedOffsets: [],
        schedule: { workoutWeekdays: [] },
      }),
    ).toEqual([]);
  });
});

describe("programRotationDayKinds", () => {
  const fill = (n: number, k: ProgramDayKind): ProgramDayKind[] =>
    Array<ProgramDayKind>(n).fill(k);
  // 6-day PPL + 1 rest = a 7-slot cycle.
  const ppl = [false, false, false, false, false, false, true];

  it("fills one slot per completed workout, consuming rest slots passed on the way", () => {
    const kinds = programRotationDayKinds({
      blockWeeks: 1,
      restByOrder: [false, false, true],
      completedWorkouts: 2,
    });
    expect(kinds).toEqual([
      "done",
      "done",
      "rest",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("advances with training, not the calendar", () => {
    // The regression: activated 26 days ago but only 5 workouts logged. The
    // calendar bar read "Week 4 of 4"; the block is really 5 slots in.
    const kinds = programRotationDayKinds({
      blockWeeks: 4,
      restByOrder: ppl,
      completedWorkouts: 5,
    });
    expect(kinds).toEqual([...fill(5, "done"), ...fill(23, "future")]);
    const progress = programWeekProgress(4, kinds);
    expect(progress.filledDays).toBe(5);
    expect(progress.weekDone).toEqual([false, false, false, false]);
    expect(Math.floor(progress.filledDays / 7) + 1).toBe(1);
  });

  it("ignites a week the moment its last workout lands", () => {
    // Trailing rest is consumed, so 6 workouts fill all 7 notches of week 1
    // rather than leaving it at 6/7 until week 2 starts.
    const kinds = programRotationDayKinds({
      blockWeeks: 4,
      restByOrder: ppl,
      completedWorkouts: 6,
    });
    expect(kinds).toEqual([...fill(6, "done"), "rest", ...fill(21, "future")]);
    const progress = programWeekProgress(4, kinds);
    expect(progress.filledDays).toBe(7);
    expect(progress.weekDone[0]).toBe(true);
  });

  it("halts at the next workout slot, leaving later rest slots empty", () => {
    const kinds = programRotationDayKinds({
      blockWeeks: 2,
      restByOrder: [false, false, true],
      completedWorkouts: 7,
    });
    expect(kinds).toEqual([
      "done",
      "done",
      "rest",
      "done",
      "done",
      "rest",
      "done",
      "done",
      "rest",
      "done",
      "future",
      "future",
      "future",
      "future",
    ]);
    const progress = programWeekProgress(2, kinds);
    expect(progress.filledDays).toBe(10);
    expect(progress.weekDone).toEqual([true, false]);
  });

  it("consumes a leading rest slot on the way to the first workout", () => {
    const kinds = programRotationDayKinds({
      blockWeeks: 1,
      restByOrder: [true, false, false],
      completedWorkouts: 1,
    });
    expect(kinds).toEqual([
      "rest",
      "done",
      "future",
      "future",
      "future",
      "future",
      "future",
    ]);
  });

  it("leaves the block empty before the first workout, even when the cycle opens with rest", () => {
    // Otherwise activating a rest-first program would hand out a free notch.
    expect(
      programRotationDayKinds({
        blockWeeks: 1,
        restByOrder: [true, false],
        completedWorkouts: 0,
      }),
    ).toEqual(fill(7, "future"));
  });

  it("completes the block exactly when the block's workouts are done", () => {
    // 4 weeks × 7 slots over the PPL cycle = 24 workouts + 4 rests. The final
    // slot is a rest — it must still fill, or the block never reaches 100%.
    const kinds = programRotationDayKinds({
      blockWeeks: 4,
      restByOrder: ppl,
      completedWorkouts: 24,
    });
    const cycle: ProgramDayKind[] = [...fill(6, "done"), "rest"];
    expect(kinds).toEqual([...cycle, ...cycle, ...cycle, ...cycle]);
    const progress = programWeekProgress(4, kinds);
    expect(progress.filledDays).toBe(28);
    expect(progress.completedWeeks).toBe(4);
  });

  it("clamps when more workouts are logged than the block has slots", () => {
    const kinds = programRotationDayKinds({
      blockWeeks: 1,
      restByOrder: [false],
      completedWorkouts: 99,
    });
    expect(kinds).toEqual(fill(7, "done"));
    expect(programWeekProgress(1, kinds).filledDays).toBe(7);
  });

  it("never fills an all-rest rotation", () => {
    // `programDayKinds` calls this all-"rest" (i.e. complete) by calendar
    // reasoning; a training-driven bar must not complete an untrainable block.
    expect(
      programRotationDayKinds({
        blockWeeks: 1,
        restByOrder: [true, true],
        completedWorkouts: 5,
      }),
    ).toEqual(fill(7, "future"));
  });

  it("treats an empty rotation as no progress", () => {
    expect(
      programRotationDayKinds({
        blockWeeks: 1,
        restByOrder: [],
        completedWorkouts: 3,
      }),
    ).toEqual(fill(7, "future"));
  });

  it("returns an empty array for a zero-week or negative block", () => {
    const args = { restByOrder: ppl, completedWorkouts: 9 };
    expect(programRotationDayKinds({ ...args, blockWeeks: 0 })).toEqual([]);
    expect(programRotationDayKinds({ ...args, blockWeeks: -3 })).toEqual([]);
  });

  it("floors a fractional block length", () => {
    expect(
      programRotationDayKinds({
        blockWeeks: 2.9,
        restByOrder: [false],
        completedWorkouts: 20,
      }),
    ).toEqual(fill(14, "done"));
  });

  it("guards a negative or fractional workout count", () => {
    expect(
      programRotationDayKinds({
        blockWeeks: 1,
        restByOrder: ppl,
        completedWorkouts: -2,
      }),
    ).toEqual(fill(7, "future"));
    expect(
      programRotationDayKinds({
        blockWeeks: 1,
        restByOrder: ppl,
        completedWorkouts: 2.7,
      }),
    ).toEqual([...fill(2, "done"), ...fill(5, "future")]);
  });

  it("consumed slots always form a prefix (what currentWeek relies on)", () => {
    // [completedWorkouts, expected prefix length]. Stated, not derived from the
    // output — and unconditional, so a mutant that fills the whole block fails
    // instead of quietly skipping every assertion.
    const cases: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [2, 2],
      [5, 5],
      [9, 10], // 9 workouts + the rest slot earned after the 6th
      [24, 28], // the whole block
    ];
    for (const [completedWorkouts, prefix] of cases) {
      const kinds = programRotationDayKinds({
        blockWeeks: 4,
        restByOrder: ppl,
        completedWorkouts,
      });
      expect(kinds.slice(prefix).every((k) => k === "future")).toBe(true);
      expect(kinds.slice(0, prefix).some((k) => k === "future")).toBe(false);
      expect(programWeekProgress(4, kinds).filledDays).toBe(prefix);
    }
  });

  it("consumes a run of consecutive trailing rests, not just the first", () => {
    // 5-on/2-off — a common shape, and the case a "halt after one trailing
    // rest" regression gets wrong: week 1 stalls at 6/7 and never ignites.
    const fiveTwo = [false, false, false, false, false, true, true];
    const kinds = programRotationDayKinds({
      blockWeeks: 4,
      restByOrder: fiveTwo,
      completedWorkouts: 5,
    });
    expect(kinds).toEqual([
      ...fill(5, "done"),
      "rest",
      "rest",
      ...fill(21, "future"),
    ]);
    const progress = programWeekProgress(4, kinds);
    expect(progress.filledDays).toBe(7);
    expect(progress.weekDone[0]).toBe(true);
  });
});

describe("daysAway", () => {
  it("returns the day-index gap", () => {
    expect(daysAway(100, 112)).toBe(12);
  });
  it("is zero on the same day", () => {
    expect(daysAway(100, 100)).toBe(0);
  });
  it("never goes negative for a future last activity", () => {
    expect(daysAway(105, 100)).toBe(0);
  });
  it("returns null when there is nothing to measure from", () => {
    // A program that has never been trained is not a layoff.
    expect(daysAway(null, 100)).toBeNull();
    expect(daysAway(undefined, 100)).toBeNull();
  });
  it("treats day index 0 as real activity, not absent", () => {
    expect(daysAway(0, 6)).toBe(6);
  });
});

describe("shouldRestartRotation", () => {
  it("pins the threshold at 5 days", () => {
    expect(LAYOFF_RESTART_DAYS).toBe(5);
  });
  it("does not restart below the threshold", () => {
    expect(shouldRestartRotation(0)).toBe(false);
    expect(shouldRestartRotation(4)).toBe(false);
  });
  it("restarts at and beyond the threshold", () => {
    expect(shouldRestartRotation(5)).toBe(true);
    expect(shouldRestartRotation(30)).toBe(true);
  });
  it("never restarts a program that has never been trained", () => {
    expect(shouldRestartRotation(null)).toBe(false);
  });
});

describe("firstWorkoutSlot", () => {
  it("is 0 when the rotation opens with a workout", () => {
    expect(
      firstWorkoutSlot([
        { order: 0, routineId: "push" },
        { order: 1, routineId: "pull" },
      ]),
    ).toBe(0);
  });
  it("skips leading rest slots so a layoff restart lands on a workout", () => {
    expect(
      firstWorkoutSlot([
        { order: 0 },
        { order: 1 },
        { order: 2, routineId: "push" },
      ]),
    ).toBe(2);
  });
  it("respects `order` rather than array position", () => {
    expect(
      firstWorkoutSlot([
        { order: 3, routineId: "legs" },
        { order: 1 },
        { order: 2, routineId: "push" },
      ]),
    ).toBe(1);
  });
  it("falls back to 0 when every day is rest", () => {
    expect(firstWorkoutSlot([{ order: 0 }, { order: 1 }])).toBe(0);
  });
  it("is 0 for an empty rotation", () => {
    expect(firstWorkoutSlot([])).toBe(0);
  });
  it("returns a cursor that resolves to a real workout (the caller's contract)", () => {
    // page.tsx feeds this straight into programTodaySlot; a rest-first rotation
    // must not land the post-layoff hero on "Rest day".
    const days = [{ order: 0 }, { order: 1 }, { order: 2, routineId: "push" }];
    const slot = programTodaySlot(days, "rotation", firstWorkoutSlot(days), 0);
    expect(slot?.routineId).toBe("push");
  });
});

describe("programCurrentWeek", () => {
  it("stays on week 1 until a week of notches is filled", () => {
    expect(programCurrentWeek(4, 0)).toBe(1);
    expect(programCurrentWeek(4, 6)).toBe(1);
  });
  it("advances a week every 7 filled notches", () => {
    expect(programCurrentWeek(4, 7)).toBe(2);
    expect(programCurrentWeek(4, 14)).toBe(3);
  });
  it("clamps a complete block to its last week rather than N+1", () => {
    // The seam this exists to pin: the raw formula yields 5 → "Week 5 of 4".
    expect(programCurrentWeek(4, 28)).toBe(4);
    expect(programCurrentWeek(4, 99)).toBe(4);
  });
  it("is 0 for a zero-week block", () => {
    expect(programCurrentWeek(0, 0)).toBe(0);
  });
});

describe("sessionCountsForProgram", () => {
  it("counts a stamped session matching the program id even when its routine is not in the set", () => {
    expect(
      sessionCountsForProgram(
        { programId: "prog_1", routineId: "rt_forked" },
        "prog_1",
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(true);
  });

  it("rejects a stamped session with a different program id even when its routine is in the set", () => {
    expect(
      sessionCountsForProgram(
        { programId: "prog_other", routineId: "rt_a" },
        "prog_1",
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(false);
  });

  it("counts a legacy session whose routine id is in the set", () => {
    expect(
      sessionCountsForProgram(
        { programId: null, routineId: "rt_a" },
        "prog_1",
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(true);
  });

  it("rejects a legacy session whose routine id is not in the set", () => {
    expect(
      sessionCountsForProgram(
        { programId: undefined, routineId: "rt_z" },
        "prog_1",
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(false);
  });

  it("rejects a legacy session with a null routine id", () => {
    expect(
      sessionCountsForProgram(
        { programId: null, routineId: null },
        "prog_1",
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(false);
  });

  it("falls back to routine match when the program has no id but the routine is in the set", () => {
    expect(
      sessionCountsForProgram(
        { programId: "prog_stamp", routineId: "rt_a" },
        undefined,
        new Set(["rt_a", "rt_b"]),
      ),
    ).toBe(true);
  });

  it("rejects a legacy session against an empty routine set", () => {
    expect(
      sessionCountsForProgram(
        { programId: null, routineId: "rt_a" },
        "prog_1",
        new Set<string>(),
      ),
    ).toBe(false);
  });
});
