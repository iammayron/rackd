"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createRoutine, startSessionFromRoutine, deleteRoutine } from "@fitnow/db";
import { getClient } from "@/lib/triplit";
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
      ownerId: "local",
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
      ownerId: "local",
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <main style={{ flex: 1, padding: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-4)" }}>
          Routines
        </h1>

        {routines.length === 0 && (
          <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
            No routines yet. Create one to run the same workout each week.
          </p>
        )}

        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {routines.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "var(--space-3) var(--space-4)",
                marginBottom: "var(--space-2)",
              }}
            >
              <Link
                href={`/routines/${r.id}`}
                style={{ flex: 1, color: "var(--text)", fontWeight: 600, textDecoration: "none" }}
              >
                {r.name}
              </Link>
              <button
                onClick={() => start(r.id)}
                style={{
                  minHeight: 40,
                  padding: "0 var(--space-4)",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius)",
                  fontWeight: 700,
                }}
              >
                Start
              </button>
              <button
                onClick={() => deleteRoutine(getClient(), r.id)}
                aria-label="Delete routine"
                style={{
                  minHeight: 40,
                  width: 36,
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "none",
                  fontSize: "var(--text-lg)",
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={create}
          style={{
            marginTop: "var(--space-4)",
            minHeight: 52,
            width: "100%",
            background: "var(--surface-2)",
            color: "var(--accent)",
            border: "1px dashed var(--border)",
            borderRadius: "var(--radius-lg)",
            fontSize: "var(--text-lg)",
            fontWeight: 700,
          }}
        >
          + New routine
        </button>
      </main>
      <Nav />
    </div>
  );
}
