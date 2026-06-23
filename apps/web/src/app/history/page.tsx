"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { exerciseStats, type ExerciseStatPoint } from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { useUnit } from "@/lib/units-store";
import { useQuery } from "@/lib/use-query";
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
interface SessionExerciseRow {
  exerciseId: string;
}
interface PRRow {
  id: string;
  type: string;
  value: number;
  achievedAt: number;
}

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
  // finished sessions only, newest first
  const { results: sessions } = useQuery<SessionRow>((c) =>
    c.query("sessions").Where("endedAt", "isDefined", true).Order("startedAt", "DESC"),
  );

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">History</h1>

        {sessions.length === 0 && (
          <p className="text-[var(--text-muted)]">No finished workouts yet.</p>
        )}

        <ul className="list-none p-0 m-0">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/history/${s.id}`}
                className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-3 px-4 mb-2 text-[var(--text)] no-underline"
              >
                <div className="flex-1">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-[var(--text-muted)]">{fmtDate(s.startedAt)}</div>
                </div>
                {s.endedAt && (
                  <span className="text-sm text-[var(--text-muted)]">
                    {fmtDuration(s.startedAt, s.endedAt)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <ExerciseProgress />
      </main>
      <Nav />
    </div>
  );
}

/** Per-exercise progress: PRs, estimated 1RM trend, and volume per session. */
function ExerciseProgress() {
  const { unit, display } = useUnit();
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );
  const { results: sessionExercises } = useQuery<SessionExerciseRow>((c) =>
    c.query("sessionExercises"),
  );

  // only exercises that actually have logged history
  const withHistory = useMemo(() => {
    const ids = new Set(sessionExercises.map((s) => s.exerciseId));
    return exercises.filter((e) => ids.has(e.id));
  }, [exercises, sessionExercises]);

  const [selected, setSelected] = useState<string>("");
  useEffect(() => {
    if (!selected && withHistory.length > 0) setSelected(withHistory[0]!.id);
  }, [withHistory, selected]);

  const [points, setPoints] = useState<ExerciseStatPoint[]>([]);
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    exerciseStats(getClient(), selected).then((p) => {
      if (!cancelled) setPoints(p);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, sessionExercises.length]);

  const { results: prs } = useQuery<PRRow>(
    (c) =>
      c
        .query("personalRecords")
        .Where("exerciseId", "=", selected || "_none_")
        .Order("value", "DESC"),
    [selected],
  );

  if (withHistory.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold mb-4">Progress</h2>

      <div className="mb-4">
        <AdvancedSelect
          value={selected}
          onChange={setSelected}
          placeholder="Choose exercise…"
          options={withHistory.map((e) => ({ value: e.id, label: e.name }))}
        />
      </div>

      {prs.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {prs.map((pr) => (
            <span
              key={pr.id}
              className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg py-2 px-3 text-sm"
            >
              🏆 {pr.type === "1rm" ? "Est 1RM" : "Top weight"}{" "}
              <strong className="text-[var(--accent)]">
                {display(pr.value)} {unit}
              </strong>
            </span>
          ))}
        </div>
      )}

      <Card title="Est 1RM over time">
        <LineChart data={points.map((p) => display(p.best1rm))} unit={unit} />
      </Card>
      <Card title="Volume per session">
        <BarChart data={points.map((p) => display(p.volume))} unit={unit} />
      </Card>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-4">
      <h2 className="text-base text-[var(--text-muted)] mb-3">{title}</h2>
      {children}
    </section>
  );
}
