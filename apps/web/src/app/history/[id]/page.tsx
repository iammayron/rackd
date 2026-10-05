"use client";

import { useParams, useRouter } from "next/navigation";
import { estimate1RM } from "@rackd/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { BackButton } from "@/components/BackButton";

interface SetRow {
  id: string;
  order: number;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  isPr: boolean;
}

interface SessionExerciseRow {
  id: string;
  order: number;
  exercise?: { name: string } | null;
  sets: SetRow[];
}

interface SessionDetail {
  id: string;
  name: string;
  startedAt: number;
  exercises: SessionExerciseRow[];
}

function ExerciseSummary({ se }: { se: SessionExerciseRow }) {
  const { unit, display } = useUnit();
  const sets = [...se.sets].sort((a, b) => a.order - b.order);
  const done = sets.filter((s) => s.completed);
  const best = done.reduce((m, s) => Math.max(m, estimate1RM(s.weight, s.reps)), 0);

  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] p-4 mb-3">
      <h2 className="text-lg font-bold mb-2">{se.exercise?.name ?? "Exercise"}</h2>
      {done.map((s) => (
        <div key={s.id} className="flex gap-3 text-[var(--text-muted)] py-0.5">
          <span className="w-6">{s.order}</span>
          <span className="text-[var(--text)]">
            {display(s.weight)} {unit} × {s.reps}
          </span>
          {s.rpe != null && <span className="text-[var(--text-muted)]">@ RPE {s.rpe}</span>}
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

  const { data: session } = useQuery({
    queryKey: qk.session(sessionId),
    queryFn: () => api<SessionDetail>(`/api/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  });

  const exercises = (session?.exercises ?? []).slice().sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton onClick={() => router.push("/history")} />
        <h1 className="text-lg font-bold">{session?.name ?? "Workout"}</h1>
      </header>

      <main className="flex-1 p-4">
        {session && (
          <p className="text-[var(--text-muted)] mb-4">
            {new Date(session.startedAt).toLocaleString()}
          </p>
        )}
        {exercises.map((se) => (
          <ExerciseSummary key={se.id} se={se} />
        ))}
      </main>
    </div>
  );
}
