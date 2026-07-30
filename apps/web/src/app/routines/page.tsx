"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, Button } from "@rackd/ui";
import { api } from "@/lib/api";
import { useConfirm } from "@/components/ConfirmDialog";
import { queryClient, qk } from "@/lib/query";
import { Nav } from "@/components/Nav";

interface RoutineRow {
  id: string;
  name: string;
  order: number;
}

export default function RoutinesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { data: routines = [] } = useQuery({
    queryKey: qk.routines,
    queryFn: () => api<RoutineRow[]>("/api/routines"),
  });
  const [busy, setBusy] = useState(false);

  async function create() {
    const r = await api<RoutineRow>("/api/routines", {
      method: "POST",
      body: JSON.stringify({ name: "New Routine", order: routines.length }),
    });
    queryClient.invalidateQueries({ queryKey: qk.routines });
    router.push(`/routines/${r.id}?from=routines`);
  }

  async function start(id: string) {
    if (busy) return;
    setBusy(true);
    const s = await api<{ id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ routineId: id }),
    });
    router.push(`/workout/${s.id}`);
  }

  async function remove(id: string, name: string) {
    // The detail page already confirms this exact deletion — the list must not
    // be the cheap way to lose a routine and every exercise/set in it.
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: "Its exercises and sets are deleted. Logged workouts are kept.",
    });
    if (!ok) return;
    await api(`/api/routines/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: qk.routines });
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
                  onClick={() => void remove(r.id, r.name)}
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
