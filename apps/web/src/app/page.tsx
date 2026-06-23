"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startSession, addSessionExercise } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
}

export default function Home() {
  const router = useRouter();
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q),
    );
  }, [exercises, search]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function start() {
    if (selected.length === 0 || starting) return;
    setStarting(true);
    const client = getClient();
    const session = await startSession(client, {
      ownerId: getCurrentUserId(),
      name: "Quick Workout",
      now: Date.now(),
    });
    await Promise.all(
      selected.map((exerciseId, i) =>
        addSessionExercise(client, { sessionId: session.id, exerciseId, order: i + 1 }),
      ),
    );
    router.push(`/workout/${session.id}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <main style={{ flex: 1, padding: "var(--space-6)", paddingBottom: 96 }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>FitNow</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
        Pick exercises, start your workout.
      </p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search exercises…"
        style={{
          width: "100%",
          minHeight: "var(--tap-min)",
          padding: "0 var(--space-4)",
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          fontSize: "var(--text-base)",
          marginBottom: "var(--space-4)",
        }}
      />

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {filtered.map((ex) => {
          const isSel = selected.includes(ex.id);
          return (
            <li key={ex.id}>
              <button
                onClick={() => toggle(ex.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  minHeight: "var(--tap-min)",
                  padding: "var(--space-3) var(--space-4)",
                  marginBottom: "var(--space-2)",
                  background: isSel ? "var(--accent)" : "var(--surface)",
                  color: isSel ? "#fff" : "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                }}
              >
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{ex.name}</span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "var(--text-sm)",
                    opacity: 0.8,
                  }}
                >
                  {ex.primaryMuscle} · {ex.equipment}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected.length > 0 && (
        <button
          onClick={start}
          disabled={starting}
          style={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 72,
            width: "min(440px, calc(100% - 32px))",
            minHeight: 52,
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
          }}
        >
          {starting ? "Starting…" : `Start workout (${selected.length})`}
        </button>
      )}
      </main>
      <Nav />
    </div>
  );
}
