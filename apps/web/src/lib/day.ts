const DAY_MS = 86_400_000;

/**
 * Local-midnight day index for an epoch ms — consecutive calendar days differ by
 * exactly 1 and any clock time on the same day collapses to one index.
 *
 * Lives here rather than in `@rackd/core` because core deliberately keeps `Date`
 * out ("all Date-handling stays in the caller" — see `currentStreak`,
 * `weekStartIndex`, `daysAway`, which all take day indices). Going through local
 * midnight rather than `Math.floor(ms / DAY_MS)` is what keeps DST honest: a
 * spring-forward day is 23h and a fall-back day 25h of wall-clock time, so UTC
 * day arithmetic would drift.
 */
export function dayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / DAY_MS);
}
