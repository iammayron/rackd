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
      ownerId: "local",
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
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
          onClick={() => router.push("/routines")}
          aria-label="Back"
          style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "var(--text-lg)" }}
        >
          ←
        </button>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => draftName.trim() && renameRoutine(getClient(), routineId, draftName.trim())}
          aria-label="Routine name"
          style={{
            flex: 1,
            background: "transparent",
            color: "var(--text)",
            border: "none",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
          }}
        />
        <button
          onClick={start}
          disabled={exercises.length === 0}
          style={{
            minHeight: 40,
            padding: "0 var(--space-4)",
            background: exercises.length ? "var(--accent)" : "var(--surface-2)",
            color: exercises.length ? "#fff" : "var(--text-muted)",
            border: "none",
            borderRadius: "var(--radius)",
            fontWeight: 700,
          }}
        >
          Start
        </button>
      </header>

      <main style={{ flex: 1, padding: "var(--space-4)" }}>
        {exercises.map((re) => (
          <RoutineExerciseEditor key={re.id} routineExercise={re} />
        ))}
        <AddExercisePicker onPick={onPick} />
      </main>
    </div>
  );
}
