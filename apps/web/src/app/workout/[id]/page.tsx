"use client";

import { useParams, useRouter } from "next/navigation";
import { finishSession } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";
import { ExerciseCard } from "@/features/active-workout/ExerciseCard";
import { RestTimerBar } from "@/features/active-workout/RestTimerBar";

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
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
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">Active Workout</h1>
        <button
          type="button"
          onClick={finish}
          className="ms-auto inline-flex items-center min-h-10 px-4 rounded-lg bg-[var(--success)] text-[#06231a] font-bold"
        >
          Finish
        </button>
      </header>

      <main className="flex-1 p-4">
        {fetching && <p className="text-[var(--text-muted)]">Loading…</p>}
        {!fetching && sessionExercises.length === 0 && (
          <p className="text-[var(--text-muted)]">No exercises in this session.</p>
        )}
        {sessionExercises.map((se) => (
          <ExerciseCard key={se.id} sessionExercise={se} />
        ))}
      </main>

      <RestTimerBar />
    </div>
  );
}
