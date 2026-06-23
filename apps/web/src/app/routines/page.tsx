"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoutine, startSessionFromRoutine, deleteRoutine } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface RoutineRow {
  id: string;
  name: string;
  order: number;
}

export default function RoutinesPage() {
  const router = useRouter();
  const { results: routines } = useQuery<RoutineRow>((c) =>
    c.query("routines").Order("order", "ASC"),
  );
  const [busy, setBusy] = useState(false);

  async function create() {
    const r = await createRoutine(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Routine",
      order: routines.length,
    });
    router.push(`/routines/${r.id}`);
  }

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    const s = await startSessionFromRoutine(getClient(), {
      routineId: id,
      ownerId: getCurrentUserId(),
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Routines</h1>

        {routines.length === 0 && (
          <p className="text-[var(--text-muted)] mb-4">
            No routines yet. Create one to run the same workout each week.
          </p>
        )}

        <ul className="list-none p-0 m-0">
          {routines.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg py-3 px-4 mb-2"
            >
              <Link
                href={`/routines/${r.id}`}
                className="flex-1 font-semibold text-[var(--text)] no-underline"
              >
                {r.name}
              </Link>
              <button
                type="button"
                onClick={() => start(r.id)}
                className="inline-flex items-center min-h-10 px-4 rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-press)]"
              >
                Start
              </button>
              <button
                type="button"
                onClick={() => deleteRoutine(getClient(), r.id)}
                aria-label="Delete routine"
                className="min-h-10 w-9 bg-transparent border-none text-lg text-[var(--text-muted)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={create}
          className="mt-4 min-h-[52px] w-full rounded-2xl bg-[var(--surface-2)] text-[var(--accent)] border border-dashed border-[var(--border)] text-lg font-bold"
        >
          + New routine
        </button>
      </main>
      <Nav />
    </div>
  );
}
