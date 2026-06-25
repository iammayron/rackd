import type { SetLog } from "./types";

/**
 * Estimate one-rep max (Epley). Pure, the single 1RM source for the whole app.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Total volume (weight x reps) for completed sets. */
export function sessionVolume(sets: SetLog[]): number {
  return sets
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export interface PlateResult {
  /** Plates for ONE side of the bar, heaviest first. */
  perSide: number[];
  /** Weight not reachable with given plates. */
  leftover: number;
}

/**
 * Break a target weight down into plates per side.
 * KISS: greedy from heaviest. Default kg plates.
 */
export function plateBreakdown(
  target: number,
  barWeight = 20,
  plates: number[] = [25, 20, 15, 10, 5, 2.5, 1.25],
): PlateResult {
  const perSide: number[] = [];
  let remaining = (target - barWeight) / 2;
  if (remaining <= 0) return { perSide, leftover: Math.max(0, target - barWeight) };

  for (const plate of [...plates].sort((a, b) => b - a)) {
    while (remaining >= plate - 1e-9) {
      perSide.push(plate);
      remaining -= plate;
    }
  }
  return { perSide, leftover: Number((remaining * 2).toFixed(3)) };
}

export interface WarmupSet {
  /** Fraction of the working weight (0 = empty bar). */
  pct: number;
  weight: number;
  reps: number;
}

/**
 * Standard warmup ramp toward a working weight. Rounds to the nearest
 * `step` (plate granularity). Empty-bar set only when it's lighter than 40%.
 */
export function warmupSets(
  workingWeight: number,
  barWeight = 20,
  step = 2.5,
): WarmupSet[] {
  if (workingWeight <= barWeight) return [];
  const round = (w: number) => Math.max(barWeight, Math.round(w / step) * step);
  const ramp: Array<{ pct: number; reps: number }> = [
    { pct: 0, reps: 8 },
    { pct: 0.4, reps: 5 },
    { pct: 0.6, reps: 3 },
    { pct: 0.8, reps: 2 },
  ];
  return ramp
    .map((r) => ({
      pct: r.pct,
      reps: r.reps,
      weight: r.pct === 0 ? barWeight : round(workingWeight * r.pct),
    }))
    .filter((s) => s.weight < workingWeight);
}

export type ProgressionScheme = "linear" | "double";

/**
 * Suggest next working weight from last performance (progressive overload).
 * KISS rules now; swap for richer model later without touching callers.
 */
export function nextWeight(
  lastWeight: number,
  lastReps: number,
  targetReps: number,
  scheme: ProgressionScheme = "double",
  increment = 2.5,
): number {
  if (scheme === "linear") return lastWeight + increment;
  // double progression: bump weight only once top of rep range is hit
  return lastReps >= targetReps ? lastWeight + increment : lastWeight;
}

/**
 * Today's workout rule: the routine scheduled for `weekday` (0=Sun … 6=Sat,
 * matching `Date.getDay()`). When several routines share the day, the
 * lowest-`order` one wins (the user's preferred ordering). Returns undefined
 * when nothing is scheduled — the dashboard then shows the "pick a routine" CTA.
 */
export function todaysRoutine<T extends { order: number; scheduledDays?: number[] }>(
  routines: readonly T[],
  weekday: number,
): T | undefined {
  return routines
    .filter((r) => r.scheduledDays?.includes(weekday))
    .sort((a, b) => a.order - b.order)[0];
}

/**
 * Local replacement suggestions for an exercise: other library exercises that
 * share the same `primaryMuscle` and/or the same `equipment`, excluding the
 * exercise itself. Ranked best-first — a match on both muscle and equipment
 * outranks a match on either alone; ties broken by name. Pure, so the UI can
 * compute suggestions offline from the in-memory library.
 */
export function suggestReplacements<
  T extends { id: string; name: string; primaryMuscle: string; equipment: string },
>(library: readonly T[], target: Pick<T, "id" | "primaryMuscle" | "equipment">): T[] {
  const score = (e: T) =>
    (e.primaryMuscle === target.primaryMuscle ? 2 : 0) +
    (e.equipment === target.equipment ? 1 : 0);
  return library
    .filter((e) => e.id !== target.id && score(e) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}

/**
 * Current workout streak in days. `workoutDays` = day indices (e.g. days since
 * the epoch, computed in local time) that have at least one completed workout;
 * `todayIndex` = today's day index. Counts consecutive days backward from
 * today, or from yesterday when today has no workout yet (so an in-progress day
 * never breaks the streak). Returns 0 when the most recent workout predates
 * yesterday. Pure — the UI maps session timestamps to local-midnight day
 * indices and passes them in.
 */
export function currentStreak(workoutDays: readonly number[], todayIndex: number): number {
  const days = new Set(workoutDays);
  let cursor = days.has(todayIndex) ? todayIndex : todayIndex - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor--;
  }
  return streak;
}

/**
 * Program scheduling — pure helpers over a program's ordered days. A day with no
 * `routineId` is a rest day. Two modes (see @rackd/core `Program`):
 *  - "weekly": each day pinned to a `weekday` (0=Sun … 6=Sat); today = the day whose
 *    `weekday` matches.
 *  - "rotation": cycle the order-sorted days; today = days[rotationCursor].
 * All Date-handling stays in the caller — pass `weekday`/`rotationCursor` in.
 */
export interface ScheduleDay {
  order: number;
  weekday?: number;
  routineId?: string;
}
export type ScheduleMode = "rotation" | "weekly";

const isRestDay = (d: ScheduleDay) => d.routineId == null;
const mod = (n: number, m: number) => ((n % m) + m) % m;

/** The day scheduled for today, or null when it's a rest day / nothing is set. */
export function programTodaySlot<T extends ScheduleDay>(
  days: readonly T[],
  mode: ScheduleMode,
  rotationCursor: number,
  weekday: number,
): T | null {
  if (days.length === 0) return null;
  if (mode === "weekly") {
    const d = days.find((x) => x.weekday === weekday);
    return d && !isRestDay(d) ? d : null;
  }
  const ordered = [...days].sort((a, b) => a.order - b.order);
  const d = ordered[mod(rotationCursor, ordered.length)]!;
  return isRestDay(d) ? null : d;
}

/** The next non-rest day after today (for the "next up" hint / skip). */
export function programNextSlot<T extends ScheduleDay>(
  days: readonly T[],
  mode: ScheduleMode,
  rotationCursor: number,
  weekday: number,
): T | null {
  if (days.length === 0) return null;
  if (mode === "weekly") {
    for (let k = 1; k <= 7; k++) {
      const wd = mod(weekday + k, 7);
      const d = days.find((x) => x.weekday === wd && !isRestDay(x));
      if (d) return d;
    }
    // Fallback for a weekly program whose days carry no `weekday` (e.g. created
    // in rotation then switched to weekly without pinning weekdays). Today is
    // still a rest day — nothing is pinned to it — but surface the first
    // scheduled workout in order so the "skip rest day" path has a next workout
    // to offer, matching the rotation experience.
    const ordered = [...days].sort((a, b) => a.order - b.order);
    return ordered.find((d) => !isRestDay(d)) ?? null;
  }
  const ordered = [...days].sort((a, b) => a.order - b.order);
  for (let k = 1; k <= ordered.length; k++) {
    const d = ordered[mod(rotationCursor + k, ordered.length)]!;
    if (!isRestDay(d)) return d;
  }
  return null;
}

/** Next rotation cursor (simple wrap-around step). Skipping rest is the caller's job. */
export function advanceRotation(cursor: number, dayCount: number): number {
  if (dayCount <= 0) return 0;
  return mod(cursor + 1, dayCount);
}

/**
 * Save-back diff (#3): compare what was performed in a session against the
 * routine's prescription, to decide whether finishing should offer to push the
 * changes back. Pure — the caller flattens the routine tree (routineExercises +
 * routineSets → targetWeight/targetReps) and the session tree (sessionExercises
 * + setLogs → weight/reps) into these shapes, ordered as displayed.
 *
 *  - `exercisesChanged`: the ordered exercise lineup differs (added/removed/
 *    swapped/reordered).
 *  - `numbersChanged`: for an exercise present in both, the set count or any
 *    weight/reps differs from the plan.
 */
export interface DiffExercise {
  exerciseId: string;
  sets: ReadonlyArray<{ weight?: number; reps?: number }>;
}
export interface SessionDiff {
  exercisesChanged: boolean;
  numbersChanged: boolean;
}

export function diffSessionVsRoutine(
  prescription: readonly DiffExercise[],
  performed: readonly DiffExercise[],
): SessionDiff {
  const exercisesChanged =
    prescription.map((e) => e.exerciseId).join("|") !==
    performed.map((e) => e.exerciseId).join("|");

  let numbersChanged = false;
  for (const p of performed) {
    const base = prescription.find((b) => b.exerciseId === p.exerciseId);
    if (!base) continue; // a brand-new exercise is an exercise change, not a number change
    if (base.sets.length !== p.sets.length) {
      numbersChanged = true;
      break;
    }
    for (let i = 0; i < p.sets.length; i++) {
      const a = p.sets[i];
      const b = base.sets[i];
      if ((a?.weight ?? 0) !== (b?.weight ?? 0) || (a?.reps ?? 0) !== (b?.reps ?? 0)) {
        numbersChanged = true;
        break;
      }
    }
    if (numbersChanged) break;
  }
  return { exercisesChanged, numbersChanged };
}

/**
 * Day index of this week's start (Monday) on or before today. `todayIndex` =
 * today's local-midnight day index (days since the epoch, computed in local
 * time); `todayWeekday` = `Date.getDay()` (0=Sun … 6=Sat). A session whose day
 * index is >= this value falls in the current week. Pure — the UI converts
 * timestamps to local-midnight day indices and reads the weekday, same split as
 * `currentStreak`/`todaysRoutine`.
 */
export function weekStartIndex(todayIndex: number, todayWeekday: number): number {
  const daysSinceMonday = (todayWeekday + 6) % 7; // Mon→0, Tue→1 … Sun→6
  return todayIndex - daysSinceMonday;
}

/**
 * The state of one calendar day within an active program's block, classified
 * by the caller from the schedule + completed sessions (Date handling stays
 * out of core, same split as `currentStreak`/`programTodaySlot`):
 *  - "done":    a workout day whose session was completed → fills the bar.
 *  - "rest":    a scheduled rest day → fills the bar as it arrives.
 *  - "missed":  a past workout day with no completed session → stays empty.
 *  - "pending": today's workout, not yet done → empty until completed.
 *  - "future":  a day that hasn't arrived yet → empty.
 */
export type ProgramDayKind = "done" | "rest" | "missed" | "pending" | "future";

export interface WeekProgress {
  /** Block length in weeks (= number of segments / dots+1). */
  blockWeeks: number;
  /** Total day-notches in the block (`blockWeeks * 7`). */
  totalDays: number;
  /** Filled notches across the whole block (`done` + `rest`), 0..totalDays. */
  filledDays: number;
  /** Fill fraction 0..1 for each week segment, length `blockWeeks`. */
  weekFill: number[];
  /** Whether each week's 7 notches are all filled (→ 🔥), length `blockWeeks`. */
  weekDone: boolean[];
  /** Count of fully-filled weeks. */
  completedWeeks: number;
}

/**
 * Roll a block's per-day states up into week segments for the dashboard's
 * progress bar. A day fills the bar when it's `done` or `rest`; a week ignites
 * (🔥) only when all 7 of its notches are filled — so a missed workout leaves a
 * gap and holds the fire. Pure: the caller builds `dayKinds` (length
 * `blockWeeks * 7`; short arrays are padded as `future`).
 */
export function programWeekProgress(
  blockWeeks: number,
  dayKinds: readonly ProgramDayKind[],
): WeekProgress {
  const weeks = Math.max(0, Math.floor(blockWeeks));
  const totalDays = weeks * 7;
  const weekFill: number[] = [];
  const weekDone: boolean[] = [];
  let filledDays = 0;
  for (let w = 0; w < weeks; w++) {
    let filledInWeek = 0;
    for (let d = 0; d < 7; d++) {
      const k = dayKinds[w * 7 + d] ?? "future";
      if (k === "done" || k === "rest") filledInWeek++;
    }
    filledDays += filledInWeek;
    weekFill.push(filledInWeek / 7);
    weekDone.push(filledInWeek === 7);
  }
  return {
    blockWeeks: weeks,
    totalDays,
    filledDays,
    weekFill,
    weekDone,
    completedWeeks: weekDone.filter(Boolean).length,
  };
}

/**
 * A program's schedule reduced to "is day N a rest day?", per mode:
 *  - "weekly": `workoutWeekdays` lists the weekdays (0=Sun … 6=Sat) that have a
 *    routine; every other weekday is rest.
 *  - "rotation": `restByOrder[k]` is true when the k-th ordered day is a rest
 *    slot. The rotation is assumed to advance one slot per calendar day from the
 *    anchor (cursor 0 on day 0); an empty rotation is all-rest.
 */
export type ProgramSchedule =
  | { mode: "weekly"; workoutWeekdays: readonly number[] }
  | { mode: "rotation"; restByOrder: readonly boolean[] };

/**
 * Classify each calendar day of a program block into a `ProgramDayKind` for the
 * dashboard bar — the input to `programWeekProgress`. Pure: the caller converts
 * timestamps to day offsets (same Date-in-the-caller split as `currentStreak` /
 * `programTodaySlot`) and passes:
 *  - `anchorWeekday`: weekday of day-offset 0 (the activation day).
 *  - `todayOffset`: today's offset from the anchor in days (0-based; may exceed
 *    the block when overrun — days past today are `future`, days before are
 *    judged done/rest/missed).
 *  - `completedOffsets`: day offsets carrying a completed program workout.
 * Precedence per day: future → done → rest → (missed if past / pending if today).
 * A completed workout logged on a rest day still counts as `done`.
 */
export function programDayKinds(args: {
  blockWeeks: number;
  anchorWeekday: number;
  todayOffset: number;
  completedOffsets: readonly number[];
  schedule: ProgramSchedule;
}): ProgramDayKind[] {
  const { blockWeeks, anchorWeekday, todayOffset, completedOffsets, schedule } =
    args;
  const totalDays = Math.max(0, Math.floor(blockWeeks)) * 7;
  const done = new Set(completedOffsets);
  const isRest = (i: number): boolean => {
    if (schedule.mode === "weekly") {
      const wd = (((anchorWeekday + i) % 7) + 7) % 7;
      return !schedule.workoutWeekdays.includes(wd);
    }
    const len = schedule.restByOrder.length;
    if (len === 0) return true;
    return schedule.restByOrder[((i % len) + len) % len]!;
  };

  const out: ProgramDayKind[] = [];
  for (let i = 0; i < totalDays; i++) {
    if (i > todayOffset) out.push("future");
    else if (done.has(i)) out.push("done");
    else if (isRest(i)) out.push("rest");
    else if (i < todayOffset) out.push("missed");
    else out.push("pending");
  }
  return out;
}
