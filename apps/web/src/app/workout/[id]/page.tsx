"use client";

import { useParams, useRouter } from "next/navigation";
import { finishSession } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";
import { ExerciseCard } from "@/features/active-workout/ExerciseCard";
import { RestTimerBar } from "@/features/active-workout/RestTimerBar";

interface SessionExerciseRow {
  id: string;
  order: number;
  restSec: number;
  exercise?: { name: string } | null;
}

export default function WorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const { results: sessionExercises, fetching } = useQuery<SessionExerciseRow>(
    (c) =>
      c
        .query("sessionExercises")
        .Where("sessionId", "=", sessionId)
        .Include("exercise")
        .Order("order", "ASC"),
    [sessionId],
  );

  async function finish() {
    await finishSession(getClient(), sessionId, Date.now());
    router.push("/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "var(--text-lg)" }}
        >
          ←
        </button>
        <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>Active Workout</h1>
        <button
          onClick={finish}
          style={{
            marginLeft: "auto",
            minHeight: 40,
            padding: "0 var(--space-4)",
            background: "var(--success)",
            color: "#06231a",
            border: "none",
            borderRadius: "var(--radius)",
            fontWeight: 700,
          }}
        >
          Finish
        </button>
      </header>

      <main style={{ flex: 1, padding: "var(--space-4)" }}>
        {fetching && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
        {!fetching && sessionExercises.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>No exercises in this session.</p>
        )}
        {sessionExercises.map((se) => (
          <ExerciseCard key={se.id} sessionExercise={se} />
        ))}
      </main>

      <RestTimerBar />
    </div>
  );
}
