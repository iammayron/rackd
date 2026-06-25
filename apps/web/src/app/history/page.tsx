"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@rackd/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { LineChart, BarChart } from "@/components/Chart";
import { AdvancedSelect } from "@/components/AdvancedSelect";
import { Nav } from "@/components/Nav";

interface SessionRow {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
}
interface ExerciseRow {
  id: string;
  name: string;
}
interface PRRow {
  id: string;
  exerciseId: string;
  type: string;
  value: number;
  achievedAt: number;
}
/** Per-session stat point for one exercise (was in @rackd/db). */
interface ExerciseStatPoint {
  sessionId: string;
  date: number;
  best1rm: number;
  volume: number;
  topWeight: number;
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtDuration(start: number, end: number): string {
  const min = Math.round((end - start) / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function HistoryPage() {
  // finished sessions only, newest first (the API orders by startedAt desc).
  const { data: sessions = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 px-5 pt-5 pb-[calc(96px+var(--safe-bottom))]">
        <div className="flex items-center mb-5">
          <h1 className="text-2xl font-extrabold">Progress</h1>
          <Link
            href="/prs"
            className="ml-auto text-sm font-bold text-[var(--accent)] no-underline"
          >
            Personal records ›
          </Link>
        </div>

        <ExerciseProgress />

        <div className={`${EYEBROW} mb-2 mt-2`}>Recent sessions</div>
        {sessions.length === 0 && (
          <p className="text-[var(--text-muted)]">
            No finished workouts yet — your streak starts here.
          </p>
        )}

        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/history/${s.id}`} className="no-underline block">
                <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--text)]">{s.name}</div>
                    <div className="text-sm text-[var(--text-muted)]">{fmtDate(s.startedAt)}</div>
                  </div>
                  {s.endedAt && (
                    <span className="text-sm text-[var(--text-muted)] tabular-nums">
                      {fmtDuration(s.startedAt, s.endedAt)}
                    </span>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Nav />
    </div>
  );
}

/** Per-exercise progress: PRs, estimated 1RM trend, and volume per session. */
function ExerciseProgress() {
  const { unit, display } = useUnit();
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
  });
  // All of the caller's PRs — every performed exercise earns one on first
  // finish, so this is our set of exercises that actually have logged history.
  const { data: allPrs = [] } = useQuery({
    queryKey: qk.personalRecords,
    queryFn: () => api<PRRow[]>("/api/personal-records"),
  });

  // only exercises that actually have logged history
  const withHistory = useMemo(() => {
    const ids = new Set(allPrs.map((p) => p.exerciseId));
    return exercises.filter((e) => ids.has(e.id));
  }, [exercises, allPrs]);

  const [selected, setSelected] = useState<string>("");
  useEffect(() => {
    if (!selected && withHistory.length > 0) setSelected(withHistory[0]!.id);
  }, [withHistory, selected]);

  const { data: points = [] } = useQuery({
    queryKey: qk.exerciseStats(selected),
    queryFn: () => api<ExerciseStatPoint[]>(`/api/exercises/${selected}/stats`),
    enabled: Boolean(selected),
  });

  const { data: prs = [] } = useQuery({
    queryKey: qk.personalRecordsForExercise(selected),
    queryFn: () => api<PRRow[]>(`/api/personal-records/exercise/${selected}`),
    enabled: Boolean(selected),
  });

  // Highest-value records first (the API orders by achievedAt).
  const sortedPrs = useMemo(
    () => [...prs].sort((a, b) => b.value - a.value),
    [prs],
  );

  if (withHistory.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="mb-3">
        <AdvancedSelect
          value={selected}
          onChange={setSelected}
          placeholder="Choose exercise…"
          options={withHistory.map((e) => ({ value: e.id, label: e.name }))}
        />
      </div>

      {sortedPrs.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {sortedPrs.map((pr) => (
            <Badge key={pr.id} tone="accent">
              🏆 {pr.type === "1rm" ? "Est 1RM" : "Top weight"} {display(pr.value)} {unit}
            </Badge>
          ))}
        </div>
      )}

      <Card variant="feature" style={{ marginBottom: 16 }}>
        <div className={`${EYEBROW} mb-3`}>Est 1RM over time</div>
        <LineChart data={points.map((p) => display(p.best1rm))} unit={unit} />
      </Card>
      <Card variant="feature" style={{ marginBottom: 16 }}>
        <div className={`${EYEBROW} mb-3`}>Volume per session</div>
        <BarChart data={points.map((p) => display(p.volume))} unit={unit} />
      </Card>
    </section>
  );
}
