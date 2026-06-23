"use client";

import { useParams, useRouter } from "next/navigation";
import { estimate1RM } from "@fitnow/core";
import { useQuery } from "@/lib/use-query";

interface SessionExerciseRow {
  id: string;
  order: number;
  exercise?: { name: string } | null;
}

interface SetRow {
  id: string;
  order: number;
  weight: number;
  reps: number;
  completed: boolean;
  isPr: boolean;
}

function ExerciseSummary({ se }: { se: SessionExerciseRow }) {
  const { results: sets } = useQuery<SetRow>(
    (c) =>
      c.query("setLogs").Where("sessionExerciseId", "=", se.id).Order("order", "ASC"),
    [se.id],
  );
  const done = sets.filter((s) => s.completed);
  const best = done.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);

  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4)",
        marginBottom: "var(--space-3)",
      }}
    >
      <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
        {se.exercise?.name ?? "Exercise"}
      </h2>
      {done.map((s) => (
        <div
          key={s.id}
          style={{ display: "flex", gap: "var(--space-3)", color: "var(--text-muted)", padding: "2px 0" }}
        >
          <span style={{ width: 24 }}>{s.order}</span>
          <span style={{ color: "var(--text)" }}>
            {s.weight} kg × {s.reps}
          </span>
          {s.isPr && <span title="Personal record">🏆</span>}
        </div>
      ))}
      {best > 0 && (
        <div style={{ marginTop: "var(--space-2)", color: "var(--accent)", fontSize: "var(--text-sm)" }}>
          est 1RM {Math.round(best)} kg
        </div>
      )}
    </section>
  );
}

export default function HistoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const { results: session } = useQuery<{ id: string; name: string; startedAt: number }>(
    (c) => c.query("sessions").Where("id", "=", sessionId),
    [sessionId],
  );
  const { results: exercises } = useQuery<SessionExerciseRow>(
    (c) =>
      c
        .query("sessionExercises")
        .Where("sessionId", "=", sessionId)
        .Include("exercise")
        .Order("order", "ASC"),
    [sessionId],
  );

  const s = session[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => router.push("/history")}
          aria-label="Back"
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "var(--text-lg)" }}
        >
          ←
        </button>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{s?.name ?? "Workout"}</h1>
      </header>

      <main style={{ flex: 1, padding: "var(--space-4)" }}>
        {s && (
          <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
            {new Date(s.startedAt).toLocaleString()}
          </p>
        )}
        {exercises.map((se) => (
          <ExerciseSummary key={se.id} se={se} />
        ))}
      </main>
    </div>
  );
}
