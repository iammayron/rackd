"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { currentStreak, weekStartIndex } from "@rackd/core";
import { useUnit } from "@/lib/units-store";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";

interface SessionRow {
  id: string;
  startedAt: number;
}

interface WeeklyVolumeRow {
  weekStart: number;
  volume: number;
}

const DAY_MS = 86_400_000;

/** Local-midnight day index for an epoch ms — consecutive days differ by 1. */
function dayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / DAY_MS);
}

/**
 * Dashboard "This week" card — an upbeat, Duolingo-style snapshot: current day
 * streak on the left, this week's training volume on the right. Streak lives
 * here (not in the sessions list) so the two motivating numbers sit together.
 */
export function ThisWeekCard() {
  const { unit, display } = useUnit();
  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });
  const { data: weeklyVolume = [] } = useQuery({
    queryKey: qk.weeklyVolume,
    queryFn: () => api<WeeklyVolumeRow[]>("/api/stats/weekly-volume"),
  });

  const streak = useMemo(
    () =>
      currentStreak(
        sessions.map((s) => dayIndex(s.startedAt)),
        dayIndex(Date.now()),
      ),
    [sessions],
  );

  const volumeKg = useMemo(() => {
    const now = Date.now();
    const weekStart =
      weekStartIndex(dayIndex(now), new Date(now).getDay()) * DAY_MS;
    return weeklyVolume
      .filter((w) => w.weekStart >= weekStart)
      .reduce((sum, w) => sum + w.volume, 0);
  }, [weeklyVolume]);

  const volume = Math.round(display(volumeKg, 0)).toLocaleString();

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        This week
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Streak
          </p>
          <p className="mt-1 text-4xl font-extrabold leading-none text-[var(--accent)] tabular-nums">
            {streak}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            day{streak === 1 ? "" : "s"} {streak > 0 ? "🔥" : ""}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Volume
          </p>
          <p className="mt-1 text-4xl font-extrabold leading-none text-[var(--accent)] tabular-nums">
            {volume}
            <span className="ml-1 text-lg font-bold">{unit}</span>
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">this week</p>
        </div>
      </div>
    </section>
  );
}
