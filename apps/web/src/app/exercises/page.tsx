"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@rackd/ui";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { ExerciseThumb } from "@/components/ExerciseMedia";
import { Nav } from "@/components/Nav";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
  thumbnailUrl?: string;
  level?: string;
}

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/** Standalone exercise library: search + filter by muscle/equipment → detail. */
export default function ExercisesPage() {
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
    select: (rows) => [...rows].sort((a, b) => a.name.localeCompare(b.name)),
  });

  const [search, setSearch] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);

  // Filter options reflect what's actually in the library.
  const muscles = useMemo(
    () => [...new Set(exercises.map((e) => e.primaryMuscle).filter(Boolean))].sort(),
    [exercises],
  );
  const equipments = useMemo(
    () => [...new Set(exercises.map((e) => e.equipment).filter(Boolean))].sort(),
    [exercises],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!muscle || e.primaryMuscle === muscle) &&
        (!equipment || e.equipment === equipment) &&
        (!q || e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q)),
    );
  }, [exercises, search, muscle, equipment]);

  const Chip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 min-h-9 px-3 rounded-full border text-sm font-semibold whitespace-nowrap ${
        active
          ? "bg-[var(--accent-wash)] text-[var(--accent)] border-[var(--accent)]"
          : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 px-5 pt-5 pb-[calc(96px+var(--safe-bottom))]">
        <h1 className="text-2xl font-extrabold mb-4">Exercises</h1>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[var(--radius)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />

        {/* Muscle filter */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <Chip active={!muscle} onClick={() => setMuscle(null)}>
            All muscles
          </Chip>
          {muscles.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {cap(m)}
            </Chip>
          ))}
        </div>

        {/* Equipment filter */}
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip active={!equipment} onClick={() => setEquipment(null)}>
            All equipment
          </Chip>
          {equipments.map((eq) => (
            <Chip key={eq} active={equipment === eq} onClick={() => setEquipment(eq)}>
              {cap(eq)}
            </Chip>
          ))}
        </div>

        <p className="mt-3 mb-2 text-sm text-[var(--text-muted)]">
          {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
        </p>

        {filtered.length === 0 ? (
          <p className="text-[var(--text-muted)] py-4">Nothing matches those filters.</p>
        ) : (
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {filtered.map((ex) => (
              <li key={ex.id}>
                <Link href={`/exercise/${ex.id}`} className="no-underline">
                  <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <ExerciseThumb ex={ex} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-[var(--text)] truncate">{ex.name}</span>
                      <span className="block text-sm text-[var(--text-muted)] truncate">
                        {ex.equipment
                          ? `${cap(ex.primaryMuscle)} · ${cap(ex.equipment)}`
                          : cap(ex.primaryMuscle)}
                      </span>
                    </span>
                    <span className="text-[var(--text-muted)]">›</span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Nav />
    </div>
  );
}
