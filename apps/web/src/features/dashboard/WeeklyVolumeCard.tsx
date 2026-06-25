"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { weekStartIndex } from "@rackd/core";
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

/** Dashboard card: this week's workout count + training volume (Mon–Sun). */
export function WeeklyVolumeCard() {
  const { unit, display } = useUnit();
  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });
  const { data: weeklyVolume = [] } = useQuery({
    queryKey: qk.weeklyVolume,
    queryFn: () => api<WeeklyVolumeRow[]>("/api/stats/weekly-volume"),
  });

  const workouts = useMemo(() => {
    const now = Date.now();
    const start = weekStartIndex(dayIndex(now), new Date(now).getDay());
    const inWeek = (ms: number) => dayIndex(ms) >= start;
    return sessions.filter((s) => inWeek(s.startedAt)).length;
  }, [sessions]);

  const volumeKg = useMemo(() => {
    const now = Date.now();
    const weekStart = weekStartIndex(dayIndex(now), new Date(now).getDay()) * DAY_MS;
    return weeklyVolume
      .filter((w) => w.weekStart >= weekStart)
      .reduce((sum, w) => sum + w.volume, 0);
  }, [weeklyVolume]);

  const volume = Math.round(display(volumeKg, 0)).toLocaleString();

  return (
    <section className="mb-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        This week
      </h2>

      {workouts === 0 ? (
        <p className="text-[var(--text-muted)]">No workouts yet this week — go lift something.</p>
      ) : (
        <div className="flex gap-8">
          <div>
            <div className="text-3xl font-extrabold text-[var(--accent)] tabular-nums">{workouts}</div>
            <div className="text-sm text-[var(--text-muted)]">
              workout{workouts === 1 ? "" : "s"}
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[var(--accent)] tabular-nums">{volume}</div>
            <div className="text-sm text-[var(--text-muted)]">{unit} volume</div>
          </div>
        </div>
      )}
    </section>
  );
}
