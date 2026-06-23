"use client";

import { useEffect, useMemo, useState } from "react";
import { exerciseStats, logBodyweight, type ExerciseStatPoint } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { LineChart, BarChart } from "@/components/Chart";
import { AdvancedSelect } from "@/components/AdvancedSelect";
import { Nav } from "@/components/Nav";

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
interface BodyRow {
  id: string;
  weightKg: number;
  date: number;
}

export default function StatsPage() {
  const { results: exercises } = useQuery<ExerciseRow>((c) => c.query("exercises").Order("name", "ASC"));
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
    (c) => c.query("personalRecords").Where("exerciseId", "=", selected || "_none_").Order("value", "DESC"),
    [selected],
  );

  const { results: body } = useQuery<BodyRow>((c) => c.query("bodyMetrics").Order("date", "ASC"));
  const [bw, setBw] = useState("");
  async function logBw() {
    const v = Number(bw);
    if (!v) return;
    await logBodyweight(getClient(), { ownerId: getCurrentUserId(), weightKg: v, now: Date.now() });
    setBw("");
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Stats</h1>

        <Card title="Bodyweight">
          <div className="flex gap-2 mb-3">
            <input
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              inputMode="decimal"
              placeholder="kg"
              aria-label="Bodyweight"
              className="flex-1 min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="button"
              onClick={logBw}
              className="min-h-11 px-4 bg-[var(--accent)] text-white border-none rounded-lg font-bold hover:bg-[var(--accent-press)]"
            >
              Log
            </button>
          </div>
          <LineChart data={body.map((b) => b.weightKg)} unit="kg" />
        </Card>

        {withHistory.length === 0 ? (
          <p className="text-[var(--text-muted)]">
            Finish a workout to see progress charts and PRs.
          </p>
        ) : (
          <>
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
                    <strong className="text-[var(--accent)]">{pr.value} kg</strong>
                  </span>
                ))}
              </div>
            )}

            <Card title="Est 1RM over time">
              <LineChart data={points.map((p) => p.best1rm)} unit="kg" />
            </Card>
            <Card title="Volume per session">
              <BarChart data={points.map((p) => p.volume)} unit="kg" />
            </Card>
          </>
        )}
      </main>
      <Nav />
    </div>
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
