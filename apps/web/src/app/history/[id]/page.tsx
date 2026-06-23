"use client";

import { useParams, useRouter } from "next/navigation";
import { estimate1RM } from "@myfit/core";
import { useUnit } from "@/lib/units-store";
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
  const { unit, display } = useUnit();
  const done = sets.filter((s) => s.completed);
  const best = done.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 mb-3">
      <h2 className="text-lg font-bold mb-2">{se.exercise?.name ?? "Exercise"}</h2>
      {done.map((s) => (
        <div key={s.id} className="flex gap-3 text-[var(--text-muted)] py-0.5">
          <span className="w-6">{s.order}</span>
          <span className="text-[var(--text)]">
            {display(s.weight)} {unit} × {s.reps}
          </span>
          {s.isPr && <span title="Personal record">🏆</span>}
        </div>
      ))}
      {best > 0 && (
        <div className="mt-2 text-sm text-[var(--accent)]">
          est 1RM {display(best)} {unit}
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
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/history")}
          aria-label="Back"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">{s?.name ?? "Workout"}</h1>
      </header>

      <main className="flex-1 p-4">
        {s && (
          <p className="text-[var(--text-muted)] mb-4">
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
