"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startSession, addSessionExercise, startSessionFromRoutine } from "@myfit/db";
import { todaysRoutine } from "@myfit/core";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";
import { Avatar } from "@/components/Avatar";
import { WeightProgressCard } from "@/features/dashboard/WeightProgressCard";
import { WeeklyVolumeCard } from "@/features/dashboard/WeeklyVolumeCard";
import { HistoryStreakCard } from "@/features/dashboard/HistoryStreakCard";

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  equipment: string;
}

interface ProfileRow {
  id: string;
  displayName?: string;
  photoUrl?: string;
}

interface RoutineRow {
  id: string;
  name: string;
  order: number;
  scheduledDays?: Set<number> | number[];
}

export default function Home() {
  const router = useRouter();
  const { results: exercises } = useQuery<ExerciseRow>((c) =>
    c.query("exercises").Order("name", "ASC"),
  );
  const { results: profiles } = useQuery<ProfileRow>((c) => c.query("userProfile"));
  const profile = profiles[0];

  const { results: routines } = useQuery<RoutineRow>((c) =>
    c.query("routines").Order("order", "ASC"),
  );
  const today = useMemo(() => {
    const normalized = routines.map((r) => ({ ...r, scheduledDays: [...(r.scheduledDays ?? [])] }));
    return todaysRoutine(normalized, new Date().getDay());
  }, [routines]);

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

  async function startToday() {
    if (!today || starting) return;
    setStarting(true);
    const s = await startSessionFromRoutine(getClient(), {
      routineId: today.id,
      ownerId: getCurrentUserId(),
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6 pb-24">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <h1 className="text-2xl font-bold">MyFit</h1>
            <p className="text-[var(--text-muted)]">Ready when you are.</p>
          </div>
          <Link href="/settings" aria-label="Profile and settings">
            <Avatar src={profile?.photoUrl || null} name={profile?.displayName} size={44} />
          </Link>
        </div>

        <section
          className={`mb-8 rounded-3xl p-6 ${
            today
              ? "bg-[var(--accent)] text-white shadow-lg"
              : "border border-dashed border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              today ? "text-white/80" : "text-[var(--text-muted)]"
            }`}
          >
            Today’s workout
          </p>
          {today ? (
            <>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight">{today.name}</h2>
              <button
                type="button"
                onClick={startToday}
                disabled={starting}
                className="mt-5 min-h-[52px] w-full rounded-2xl bg-white text-[var(--accent)] text-lg font-bold disabled:opacity-60"
              >
                {starting ? "Starting…" : "Start workout"}
              </button>
            </>
          ) : (
            <>
              <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">Rest day</h2>
              <p className="mt-1 text-[var(--text-muted)]">
                Nothing scheduled for today.
              </p>
              <Link
                href="/routines"
                className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[var(--accent)] text-lg font-bold text-white no-underline"
              >
                Pick a routine to start
              </Link>
            </>
          )}
        </section>

        <WeightProgressCard />

        <WeeklyVolumeCard />

        <HistoryStreakCard />

        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Quick workout
        </h2>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Pick exercises to start an ad-hoc session.
        </p>

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
