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
