/** The fields `copyTargets` needs from a set — structural, so SetRowData fits. */
export interface CopyCandidate {
  order: number;
  /** Canonical kg. */
  weight: number;
  reps: number;
  completed: boolean;
}

/**
 * Which later sets the "copy weight & reps to remaining sets?" prompt should
 * offer to overwrite: sets after `from` that aren't done yet and don't already
 * show the same numbers.
 *
 * `display` is the caller's kg → display-unit rounding, and comparing through it
 * is the whole point. Storage is canonical kg while the lifter reads a value
 * rounded to one decimal, so two sets can differ far below what's shown — 42.5
 * kg and 42.5019 kg both read "93.7 lb". Comparing raw kg made the prompt fire
 * for sets the lifter had already matched up, which reads as a bug.
 *
 * Returns [] when there's nothing worth prompting about; the caller shows no
 * toast in that case.
 */
export function copyTargets<T extends CopyCandidate>(
  sets: readonly T[],
  from: CopyCandidate,
  display: (kg: number) => number,
): T[] {
  return sets.filter(
    (s) =>
      s.order > from.order &&
      !s.completed &&
      (display(s.weight) !== display(from.weight) || s.reps !== from.reps),
  );
}
