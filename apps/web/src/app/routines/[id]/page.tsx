"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  renameRoutine,
  addRoutineExercise,
  addRoutineSet,
  startSessionFromRoutine,
} from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { RoutineExerciseEditor } from "@/features/routines/RoutineExerciseEditor";
import { AddExercisePicker } from "@/features/routines/AddExercisePicker";

interface RoutineExerciseRow {
  id: string;
  order: number;
  exercise?: { name: string } | null;
}

export default function RoutineEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routineId = params.id;

  const { results: routine } = useQuery<{ id: string; name: string }>(
    (c) => c.query("routines").Where("id", "=", routineId),
    [routineId],
  );
  const name = routine[0]?.name ?? "";

  const { results: exercises } = useQuery<RoutineExerciseRow>(
    (c) =>
      c
        .query("routineExercises")
        .Where("routineId", "=", routineId)
        .Include("exercise")
        .Order("order", "ASC"),
    [routineId],
  );

  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  async function onPick(exerciseId: string) {
    const re = await addRoutineExercise(getClient(), {
      routineId,
      exerciseId,
      order: exercises.length + 1,
    });
    // seed one starter set so the card isn't empty
    await addRoutineSet(getClient(), { routineExerciseId: re.id, order: 1, targetReps: 8 });
  }

  async function start() {
    const s = await startSessionFromRoutine(getClient(), {
      routineId,
      ownerId: getCurrentUserId(),
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/routines")}
          aria-label="Back"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ←
        </button>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => draftName.trim() && renameRoutine(getClient(), routineId, draftName.trim())}
          aria-label="Routine name"
          className="flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        <button
          type="button"
          onClick={start}
          disabled={exercises.length === 0}
          className={`inline-flex items-center min-h-10 px-4 rounded-lg font-bold ${
            exercises.length
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface-2)] text-[var(--text-muted)]"
          }`}
        >
          Start
        </button>
      </header>

      <main className="flex-1 p-4">
        {exercises.map((re) => (
          <RoutineExerciseEditor key={re.id} routineExercise={re} />
        ))}
        <AddExercisePicker onPick={onPick} />
      </main>
    </div>
  );
}
