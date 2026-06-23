"use client";

import { useMemo } from "react";
import { sessionVolume, weekStartIndex } from "@myfit/core";
import type { SetLog } from "@myfit/core";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";

interface SessionRow {
  id: string;
  startedAt: number;
}

interface SessionExerciseRow {
  id: string;
  sessionId: string;
}

type SetRow = Pick<SetLog, "id" | "sessionExerciseId" | "weight" | "reps" | "completed">;

const DAY_MS = 86_400_000;

/** Local-midnight day index for an epoch ms — consecutive days differ by 1. */
function dayIndex(ms: number): number {
  return Math.floor(new Date(ms).setHours(0, 0, 0, 0) / DAY_MS);
}

/** Dashboard card: this week's workout count + training volume (Mon–Sun). */
export function WeeklyVolumeCard() {
  const { unit, display } = useUnit();
  const { results: sessions } = useQuery<SessionRow>((c) => c.query("sessions"));
  const { results: sessionExercises } = useQuery<SessionExerciseRow>((c) =>
    c.query("sessionExercises"),
  );
  const { results: setLogs } = useQuery<SetRow>((c) => c.query("setLogs"));

  const { workouts, volumeKg } = useMemo(() => {
    const now = Date.now();
    const start = weekStartIndex(dayIndex(now), new Date(now).getDay());
    const inWeek = (ms: number) => dayIndex(ms) >= start;

    const weekSessionIds = new Set(
      sessions.filter((s) => inWeek(s.startedAt)).map((s) => s.id),
    );
    const weekSeIds = new Set(
      sessionExercises.filter((se) => weekSessionIds.has(se.sessionId)).map((se) => se.id),
    );
    const weekSets = setLogs.filter((s) => weekSeIds.has(s.sessionExerciseId));

    return { workouts: weekSessionIds.size, volumeKg: sessionVolume(weekSets as SetLog[]) };
  }, [sessions, sessionExercises, setLogs]);

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
            <div className="text-3xl font-extrabold text-[var(--accent)]">{workouts}</div>
            <div className="text-sm text-[var(--text-muted)]">
              workout{workouts === 1 ? "" : "s"}
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-[var(--accent)]">{volume}</div>
            <div className="text-sm text-[var(--text-muted)]">{unit} volume</div>
          </div>
        </div>
      )}
    </section>
  );
}
