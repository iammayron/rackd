export interface PRRowLite {
  exerciseId: string;
  type: string;
  value: number;
  achievedAt: number;
}
export interface ExerciseLite {
  id: string;
  name: string;
  primaryMuscle: string;
}

/** Best record per exercise, derived from all of the user's personalRecords. */
export interface BestPR {
  exerciseId: string;
  name: string;
  muscle: string;
  type: string;
  value: number;
  achievedAt: number;
  fresh: boolean;
}

/** Midnight on the Monday of the week containing `now` (local). */
export function startOfWeek(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const sinceMon = (d.getDay() + 6) % 7; // 0=Sun → 6, 1=Mon → 0
  d.setDate(d.getDate() - sinceMon);
  return d.getTime();
}

/**
 * Collapse every personalRecord into one best row per exercise — preferring the
 * estimated-1RM record, else the highest value — newest first. `fresh` marks a
 * record set this week (drives the "PR" badge). Shared by the PR page and the
 * Progress-page summary card so both rank identically.
 */
export function bestPrsByExercise(
  prs: PRRowLite[],
  exercises: ExerciseLite[],
  now: number,
): BestPR[] {
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const weekStart = startOfWeek(now);
  const best = new Map<string, BestPR>();
  for (const pr of prs) {
    const ex = exMap.get(pr.exerciseId);
    if (!ex) continue;
    const cur = best.get(pr.exerciseId);
    const prefer =
      !cur ||
      (pr.type === "1rm" && cur.type !== "1rm") ||
      (pr.type === cur.type && pr.value > cur.value);
    if (prefer) {
      best.set(pr.exerciseId, {
        exerciseId: pr.exerciseId,
        name: ex.name,
        muscle: ex.primaryMuscle,
        type: pr.type,
        value: pr.value,
        achievedAt: pr.achievedAt,
        fresh: pr.achievedAt >= weekStart,
      });
    }
  }
  return [...best.values()].sort((a, b) => b.achievedAt - a.achievedAt);
}
