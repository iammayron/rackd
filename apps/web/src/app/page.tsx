"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startSession, addSessionExercise, startSessionFromRoutine } from "@rackd/db";
import { todaysRoutine } from "@rackd/core";
import { Card, Button, Avatar, Input, SelectableRow } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";
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

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

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
  const [quickOpen, setQuickOpen] = useState(false);

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
      <main className="flex-1 px-5 pt-5 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-mark.svg" alt="" width={34} height={34} className="block" />
          <div className="flex-1">
            <div className="text-2xl font-extrabold leading-none tracking-[-0.01em]">Rackd</div>
            <div className="text-[var(--text-muted)] text-sm">Ready when you are.</div>
          </div>
          <Link href="/settings" aria-label="Profile and settings">
            <Avatar src={profile?.photoUrl || null} name={profile?.displayName} />
          </Link>
        </div>

        {/* Today — the one hero action, or a Rest day */}
        {today ? (
          <Card variant="accent" style={{ marginBottom: 24 }}>
            <div className="text-xs font-bold uppercase tracking-[0.06em] opacity-85 whitespace-nowrap">
              Today&apos;s workout
            </div>
            <div className="mt-2 text-3xl font-extrabold leading-[1.05]">{today.name}</div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={startToday}
              disabled={starting}
              style={{ marginTop: 18, background: "#fff", color: "var(--accent)", border: "none" }}
            >
              {starting ? "Starting…" : "Start workout"}
            </Button>
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className="block w-full mt-2.5 py-1.5 bg-transparent border-none cursor-pointer text-sm font-bold text-white/90 text-center"
            >
              Start quick workout ›
            </button>
          </Card>
        ) : (
          <Card variant="dashed" style={{ marginBottom: 24, textAlign: "center", padding: 28 }}>
            <div className={EYEBROW}>Today</div>
            <div className="mt-1.5 text-3xl font-extrabold leading-[1.1]">Rest day</div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              Nothing scheduled — recovery is where you grow.
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setQuickOpen(true)}
              style={{ marginTop: 18 }}
            >
              Start quick workout
            </Button>
          </Card>
        )}

        <WeightProgressCard />
        <WeeklyVolumeCard />
        <HistoryStreakCard />

        {/* Quick ad-hoc workout — pick exercises to start a session with no routine */}
        {quickOpen && (
          <section className="mt-2">
            <h2 className={`${EYEBROW} mb-1`}>Quick workout</h2>
            <p className="mb-3 text-sm text-[var(--text-muted)]">
              Pick exercises to start an ad-hoc session.
            </p>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              style={{ marginBottom: 12 }}
            />

            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {filtered.map((ex) => (
                <li key={ex.id}>
                  <SelectableRow
                    title={ex.name}
                    meta={`${ex.primaryMuscle} · ${ex.equipment}`}
                    selected={selected.includes(ex.id)}
                    onClick={() => toggle(ex.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {selected.length > 0 && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-[84px] w-[min(440px,calc(100%-32px))] z-30">
            <Button variant="primary" size="lg" fullWidth onClick={start} disabled={starting}>
              {starting ? "Starting…" : `Start workout (${selected.length})`}
            </Button>
          </div>
        )}
      </main>
      <Nav />
    </div>
  );
}
