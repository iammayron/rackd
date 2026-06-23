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
