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
