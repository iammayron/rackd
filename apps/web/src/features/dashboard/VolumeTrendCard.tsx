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

/** Compact tonnage label, e.g. "38.2t" (display units already applied). */
function tonnage(value: number): string {
  return `${(value / 1000).toFixed(1)}t`;
}

/**
 * Progress-page "Volume" trend — the last six weeks of training volume as bars,
 * with the first→last percentage change. Reads the same weekly buckets as the
 * stat row; hidden until there are at least two weeks to compare.
 */
export function VolumeTrendCard() {
  const { unit, display } = useUnit();
  const { data: weeklyVolume = [] } = useQuery({
    queryKey: qk.weeklyVolume,
    queryFn: () => api<WeeklyVolumeRow[]>("/api/stats/weekly-volume"),
  });

  const weeks = useMemo(() => {
    // API returns ascending by weekStart; take the most recent six.
    return weeklyVolume.slice(-WEEKS).map((w) => display(w.volume));
  }, [weeklyVolume, display]);

  if (weeks.length < 2) return null;

  const first = weeks[0]!;
  const last = weeks[weeks.length - 1]!;
  const deltaPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  const up = deltaPct >= 0;

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Volume
        </h2>
        <span className="text-sm font-semibold text-[var(--text-muted)]">last {weeks.length} weeks</span>
      </div>

      <BarChart data={weeks} unit={unit} />

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-[var(--text-muted)] tabular-nums">{tonnage(first)}</span>
        <span className="font-bold text-[var(--accent)] tabular-nums">
          {up ? "+" : ""}
          {deltaPct}% {up ? "↑" : "↓"}
        </span>
        <span className="text-[var(--text-muted)] tabular-nums">{tonnage(last)}</span>
      </div>
    </section>
  );
}
