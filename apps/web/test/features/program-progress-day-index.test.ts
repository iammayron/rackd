import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dayIndex } from "@/lib/day";

/**
 * `dayIndex` anchors the week-block progress bar: it must map an epoch ms to a
 * *local* calendar-day number such that consecutive calendar days differ by
 * exactly 1 and any clock time on the same day collapses to one index. The
 * fragile part is DST — a spring-forward day is 23h and a fall-back day 25h of
 * wall-clock time, so naive `Math.floor(ms / DAY_MS)` (UTC days) would drift.
 * We pin the whole file to a DST-observing zone so the boundaries are exercised
 * deterministically regardless of the host machine's timezone.
 */
const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

// Local-time midnight epoch for a calendar day (month is 0-based).
const localDay = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m, d, h, min).getTime();

describe("dayIndex", () => {
  it("collapses every clock time of a local day to one index", () => {
    const day = dayIndex(localDay(2025, 5, 24, 0, 1));
    expect(dayIndex(localDay(2025, 5, 24, 12, 0))).toBe(day);
    expect(dayIndex(localDay(2025, 5, 24, 23, 59))).toBe(day);
  });

  it("steps consecutive calendar days by exactly 1", () => {
    const a = dayIndex(localDay(2025, 5, 24));
    const b = dayIndex(localDay(2025, 5, 25));
    expect(b - a).toBe(1);
  });

  it("keeps a +1 step across the spring-forward boundary (23h day)", () => {
    // US spring-forward: 2025-03-09 02:00 → 03:00 (that local day is only 23h).
    const mar8 = dayIndex(localDay(2025, 2, 8, 12));
    const mar9 = dayIndex(localDay(2025, 2, 9, 12));
    const mar10 = dayIndex(localDay(2025, 2, 10, 12));
    expect(mar9 - mar8).toBe(1);
    expect(mar10 - mar9).toBe(1);
  });

  it("keeps a +1 step across the fall-back boundary (25h day)", () => {
    // US fall-back: 2025-11-02 02:00 → 01:00 (that local day is 25h long).
    const nov1 = dayIndex(localDay(2025, 10, 1, 12));
    const nov2 = dayIndex(localDay(2025, 10, 2, 12));
    const nov3 = dayIndex(localDay(2025, 10, 3, 12));
    expect(nov2 - nov1).toBe(1);
    expect(nov3 - nov2).toBe(1);
  });

  it("collapses both ambiguous fall-back hours to the same day index", () => {
    // 01:30 occurs twice on 2025-11-02 (EDT then EST); both are that calendar day.
    const day = dayIndex(localDay(2025, 10, 2, 12));
    expect(dayIndex(localDay(2025, 10, 2, 0, 30))).toBe(day);
    expect(dayIndex(localDay(2025, 10, 2, 23, 30))).toBe(day);
  });
});
