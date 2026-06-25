"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoutine, startSessionFromRoutine, deleteRoutine } from "@rackd/db";
import { Card, Button } from "@rackd/ui";
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
    router.push(`/routines/${r.id}?from=routines`);
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
      <main className="flex-1 px-5 pt-5 pb-[calc(96px+var(--safe-bottom))]">
        <div className="flex items-center mb-5">
          <h1 className="text-2xl font-extrabold">Routines</h1>
          <Link
            href="/discover"
            className="ms-auto text-sm font-semibold text-[var(--accent)] no-underline"
          >
            Discover →
          </Link>
        </div>

        {routines.length === 0 && (
          <p className="text-[var(--text-muted)] mb-4">
            No routines yet. Create one to run the same workout each week.
          </p>
        )}

        <ul className="list-none p-0 m-0 flex flex-col gap-2">
          {routines.map((r) => (
            <li key={r.id}>
              <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link
                  href={`/routines/${r.id}?from=routines`}
                  className="flex-1 font-semibold text-[var(--text)] no-underline"
                >
                  {r.name}
                </Link>
                <Button variant="primary" size="sm" onClick={() => start(r.id)}>
                  Start
                </Button>
                <button
                  type="button"
                  onClick={() => deleteRoutine(getClient(), r.id)}
                  aria-label="Delete routine"
                  className="min-h-10 w-9 bg-transparent border-none text-lg text-[var(--text-muted)]"
                >
                  ×
                </button>
              </Card>
            </li>
          ))}
        </ul>

        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={create}
          style={{ marginTop: 16, borderStyle: "dashed", color: "var(--accent)" }}
        >
          + New routine
        </Button>
      </main>
      <Nav />
    </div>
  );
}
