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

function Stat({ label, value, suffix, caption }: { label: string; value: string; suffix?: string; caption: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-3xl font-extrabold leading-none text-[var(--accent)] tabular-nums">
        {value}
        {suffix && <span className="ml-1 text-base font-bold">{suffix}</span>}
      </p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{caption}</p>
    </div>
  );
}

/**
 * Progress-page stat row — streak, workouts this week, and weekly volume. Same
 * sources as the home {@link ThisWeekCard}, expanded to three tiles (adds the
 * workout count) to match the Progress header.
 */
export function ProgressStats() {
  const { unit, display } = useUnit();
  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });
  const { data: weeklyVolume = [] } = useQuery({
    queryKey: qk.weeklyVolume,
    queryFn: () => api<WeeklyVolumeRow[]>("/api/stats/weekly-volume"),
  });

  const { streak, weekCount, volume } = useMemo(() => {
    const now = Date.now();
    const weekStart = weekStartIndex(dayIndex(now), new Date(now).getDay()) * DAY_MS;
    const streak = currentStreak(sessions.map((s) => dayIndex(s.startedAt)), dayIndex(now));
    const weekCount = sessions.filter((s) => s.startedAt >= weekStart).length;
    const volumeKg = weeklyVolume
      .filter((w) => w.weekStart >= weekStart)
      .reduce((sum, w) => sum + w.volume, 0);
    return {
      streak,
      weekCount,
      volume: Math.round(display(volumeKg, 0)).toLocaleString(),
    };
  }, [sessions, weeklyVolume, display]);

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Streak" value={String(streak)} caption={`day${streak === 1 ? "" : "s"} ${streak > 0 ? "🔥" : ""}`} />
        <Stat label="This week" value={String(weekCount)} caption={`workout${weekCount === 1 ? "" : "s"}`} />
        <Stat label="Volume" value={volume} suffix={unit} caption="this week" />
      </div>
    </section>
  );
}
