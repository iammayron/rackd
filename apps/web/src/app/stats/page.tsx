"use client";

import { useEffect, useMemo, useState } from "react";
import { exerciseStats, logBodyweight, type ExerciseStatPoint } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { LineChart, BarChart } from "@/components/Chart";
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
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <main style={{ flex: 1, padding: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
          Stats
        </h1>

        <Card title="Bodyweight">
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
            <input
              value={bw}
              onChange={(e) => setBw(e.target.value)}
              inputMode="decimal"
              placeholder="kg"
              aria-label="Bodyweight"
              style={{
                flex: 1,
                minHeight: "var(--tap-min)",
                padding: "0 var(--space-3)",
                background: "var(--surface-2)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "var(--text-base)",
              }}
            />
            <button
              onClick={logBw}
              style={{
                minHeight: "var(--tap-min)",
                padding: "0 var(--space-4)",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius)",
                fontWeight: 700,
              }}
            >
              Log
            </button>
          </div>
          <LineChart data={body.map((b) => b.weightKg)} unit="kg" />
        </Card>

        {withHistory.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            Finish a workout to see progress charts and PRs.
          </p>
        ) : (
          <>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Exercise"
              style={{
                width: "100%",
                minHeight: "var(--tap-min)",
                padding: "0 var(--space-3)",
                background: "var(--surface)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: "var(--text-base)",
                marginBottom: "var(--space-4)",
              }}
            >
              {withHistory.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            {prs.length > 0 && (
              <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
                {prs.map((pr) => (
                  <span
                    key={pr.id}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "var(--space-2) var(--space-3)",
                      fontSize: "var(--text-sm)",
                    }}
                  >
                    🏆 {pr.type === "1rm" ? "Est 1RM" : "Top weight"}{" "}
                    <strong style={{ color: "var(--accent)" }}>{pr.value} kg</strong>
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
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <h2 style={{ fontSize: "var(--text-base)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
