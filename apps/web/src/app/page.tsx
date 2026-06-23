"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startSession, addSessionExercise } from "@myfit/db";
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
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6 pb-24">
        <h1 className="text-2xl font-bold">MyFit</h1>
        <p className="text-[var(--text-muted)] mb-4">Pick exercises, start your workout.</p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full min-h-11 px-4 mb-4 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />

        <ul className="list-none p-0 m-0">
          {filtered.map((ex) => {
            const isSel = selected.includes(ex.id);
            return (
              <li key={ex.id}>
                <button
                  type="button"
                  onClick={() => toggle(ex.id)}
                  className={`w-full text-left flex items-center gap-3 min-h-11 py-3 px-4 mb-2 border border-[var(--border)] rounded-lg ${
                    isSel ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text)]"
                  }`}
                >
                  <span className="text-base font-semibold">{ex.name}</span>
                  <span className="ms-auto text-sm opacity-80">
                    {ex.primaryMuscle} · {ex.equipment}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="fixed left-1/2 -translate-x-1/2 bottom-[72px] w-[min(440px,calc(100%-32px))] min-h-[52px] rounded-2xl bg-[var(--accent)] text-white border-none text-lg font-bold disabled:opacity-60"
          >
            {starting ? "Starting…" : `Start workout (${selected.length})`}
          </button>
        )}
      </main>
      <Nav />
    </div>
  );
}
