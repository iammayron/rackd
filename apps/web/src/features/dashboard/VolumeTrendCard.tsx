"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUnit } from "@/lib/units-store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { BarChart } from "@/components/Chart";

interface WeeklyVolumeRow {
  weekStart: number;
  volume: number;
}

const WEEKS = 6;
const DAY_MS = 86_400_000;

/** Compact tonnage label, e.g. "38.2t" (display units already applied). */
function tonnage(value: number): string {
  return `${(value / 1000).toFixed(1)}t`;
}

/** Monday 00:00 UTC of the ISO week containing `ms` — mirrors the API's buckets. */
function weekStartUTC(ms: number): number {
  const d = new Date(ms);
  const since = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - since);
}

/**
 * Progress-page "Volume" trend — a fixed six-week window so the chart always has
 * a full row of bars: weeks with no training render as a flat baseline, the ones
 * with volume rise above it. Reads the same weekly buckets as the stat row.
 */
export function VolumeTrendCard() {
  const { unit, display } = useUnit();
  const { data: weeklyVolume = [] } = useQuery({
    queryKey: qk.weeklyVolume,
    queryFn: () => api<WeeklyVolumeRow[]>("/api/stats/weekly-volume"),
  });

  // A continuous WEEKS-long series ending this week (missing weeks → 0), plus the
  // real logged weeks for the delta/tonnage labels.
  const { series, actual } = useMemo(() => {
    const byWeek = new Map(weeklyVolume.map((w) => [w.weekStart, w.volume]));
    const thisMon = weekStartUTC(Date.now());
    const series: number[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      series.push(display(byWeek.get(thisMon - i * 7 * DAY_MS) ?? 0));
    }
    const actual = [...weeklyVolume]
      .sort((a, b) => a.weekStart - b.weekStart)
      .map((w) => display(w.volume));
    return { series, actual };
  }, [weeklyVolume, display]);

  const first = actual[0];
  const last = actual[actual.length - 1];
  const deltaPct = first && last && first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  const up = deltaPct >= 0;

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Volume
        </h2>
        {actual.length > 0 && (
          <span className="text-sm font-semibold text-[var(--text-muted)]">last {WEEKS} weeks</span>
        )}
      </div>

      {actual.length === 0 ? (
        <p className="text-[var(--text-muted)]">
          No volume yet. Finish a workout to start your trend.
        </p>
      ) : (
        <>
          <BarChart data={series} unit={unit} />
          {actual.length >= 2 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)] tabular-nums">{tonnage(first!)}</span>
              <span className="font-bold text-[var(--accent)] tabular-nums">
                {up ? "+" : ""}
                {deltaPct}% {up ? "↑" : "↓"}
              </span>
              <span className="text-[var(--text-muted)] tabular-nums">{tonnage(last!)}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
