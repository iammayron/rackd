"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  todaysRoutine,
  programTodaySlot,
  programNextSlot,
  advanceRotation,
  estimateSessionMinutes,
} from "@rackd/core";
import { Card, Button, Badge, Avatar, Input, SelectableRow } from "@rackd/ui";
import { BottomSheet } from "@/components/BottomSheet";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { Nav } from "@/components/Nav";
import { ActivateProgramSheet } from "@/components/ActivateProgramSheet";
import { ThisWeekCard } from "@/features/dashboard/ThisWeekCard";
import { RecentSessionsCard } from "@/features/dashboard/RecentSessionsCard";
import { ProgramProgress } from "@/features/dashboard/ProgramProgress";

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

interface ProgramRow {
  id: string;
  name: string;
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  rotationCursor?: number;
  blockWeeks?: number;
  activatedAt?: number;
}

interface ProgramDayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}

interface SessionRow {
  id: string;
  name: string;
  routineId?: string | null;
  programId?: string | null;
  startedAt: number;
  endedAt?: number | null;
}

interface RoutineDetailRow {
  exercises: { restSec?: number; sets?: unknown[] }[];
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

export default function Home() {
  const router = useRouter();
  const { data: exercises = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: async () => {
      const rows = await api<ExerciseRow[]>("/api/exercises");
      return [...rows].sort((a, b) => a.name.localeCompare(b.name));
    },
  });
  const { data: profile } = useQuery({
    queryKey: qk.profile,
    queryFn: () => api<ProfileRow>("/api/profile"),
  });

  const { data: routines = [] } = useQuery({
    queryKey: qk.routines,
    queryFn: () => api<RoutineRow[]>("/api/routines"),
  });

  // An unfinished session takes over the hero: while a workout is in progress
  // we offer Resume, never a Start that would spawn a duplicate session.
  const { data: active } = useQuery({
    queryKey: qk.activeSession,
    queryFn: () =>
      api<{ id: string; name: string } | null>("/api/sessions/active"),
  });

  // Finished sessions (newest first) — used to flip the hero into a "done"
  // state once today's scheduled workout has already been completed.
  const { data: finished = [] } = useQuery({
    queryKey: qk.sessions,
    queryFn: () => api<SessionRow[]>("/api/sessions"),
  });

  // The active program (if any) drives "today"; otherwise fall back to a
  // routine scheduled for today's weekday.
  const { data: programs = [] } = useQuery({
    queryKey: qk.programs,
    queryFn: () => api<ProgramRow[]>("/api/programs"),
  });
  const activeProgram = programs.find((p) => p.active);
  const { data: activeProgramDetail } = useQuery({
    queryKey: qk.program(activeProgram?.id ?? ""),
    queryFn: () =>
      api<{ days: ProgramDayRow[] }>(`/api/programs/${activeProgram!.id}`),
    enabled: Boolean(activeProgram?.id),
  });
  const programDays = useMemo(
    () => activeProgramDetail?.days ?? [],
    [activeProgramDetail],
  );

  // Program progress: how many workouts have been logged against this program's
  // routines (lifetime), and where that lands within the current block. The
  // rotation cursor only moves on "Skip", so completed-session count is the
  // honest measure of progress — not the cursor.
  const programRoutineIds = useMemo(
    () =>
      new Set(
        programDays
          .map((d) => d.routineId)
          .filter((id): id is string => Boolean(id)),
      ),
    [programDays],
  );
  const weekday = new Date().getDay();
  const fallbackToday = useMemo(() => {
    const normalized = routines.map((r) => ({
      ...r,
      scheduledDays: [...(r.scheduledDays ?? [])],
    }));
    return todaysRoutine(normalized, weekday);
  }, [routines, weekday]);

  const routineName = (id?: string) => routines.find((r) => r.id === id)?.name;

  const slot = activeProgram
    ? programTodaySlot(
        programDays,
        activeProgram.scheduleMode ?? "rotation",
        activeProgram.rotationCursor ?? 0,
        weekday,
      )
    : null;
  const nextSlot = activeProgram
    ? programNextSlot(
        programDays,
        activeProgram.scheduleMode ?? "rotation",
        activeProgram.rotationCursor ?? 0,
        weekday,
      )
    : null;

  // slot is null on a rest day (or no active program → use the weekday fallback).
  const heroRoutineId = activeProgram ? slot?.routineId : fallbackToday?.id;
  const heroName = activeProgram
    ? routineName(slot?.routineId)
    : fallbackToday?.name;
  const nextName = routineName(nextSlot?.routineId);
  const isRest = !heroRoutineId;

  // Hero subtitle ("N exercises · ~M min"): fetch the hero routine's tree and
  // estimate its run time from set counts + configured rests (pure core fn).
  const { data: heroDetail } = useQuery({
    queryKey: qk.routine(heroRoutineId ?? ""),
    queryFn: () => api<RoutineDetailRow>(`/api/routines/${heroRoutineId}`),
    enabled: Boolean(heroRoutineId),
  });
  const heroEstimate = useMemo(() => {
    const ex = heroDetail?.exercises ?? [];
    if (ex.length === 0) return null;
    return {
      count: ex.length,
      minutes: estimateSessionMinutes(
        ex.map((e) => ({ setCount: e.sets?.length ?? 0, restSec: e.restSec })),
      ),
    };
  }, [heroDetail]);

  // A program workout finished today → celebrate. Finishing advances the
  // rotation cursor server-side, so `slot` already points at the *next* workout;
  // we therefore detect "done" from the finished session itself, not the current
  // slot. Most-recent-first so a second workout the same day wins the headline.
  const completedToday = useMemo(() => {
    if (!activeProgram) return undefined;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const since = dayStart.getTime();
    return finished
      .filter(
        (s) =>
          s.routineId &&
          programRoutineIds.has(s.routineId) &&
          (s.endedAt ?? 0) >= since,
      )
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];
  }, [activeProgram, finished, programRoutineIds]);
  const completedName = completedToday
    ? routineName(completedToday.routineId ?? undefined)
    : undefined;
  const canSkip =
    !!activeProgram &&
    (activeProgram.scheduleMode ?? "rotation") === "rotation" &&
    programDays.length > 0;

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  // Close the quick-workout sheet and reset its picker state for next time.
  function closeQuick() {
    setQuickOpen(false);
    setSelected([]);
    setSearch("");
  }
  const [skipRevealed, setSkipRevealed] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  const programChoices = useMemo(
    () =>
      programs.map((p) => ({
        id: p.id,
        name: p.name,
        meta:
          (p.scheduleMode ?? "rotation") === "weekly"
            ? "Fixed weekly"
            : "Rotation",
      })),
    [programs],
  );

  async function activateProgram(programId: string) {
    setActivateOpen(false);
    await api(`/api/programs/${programId}`, {
      method: "PUT",
      body: JSON.stringify({ active: true }),
    });
    queryClient.invalidateQueries({ queryKey: qk.programs });
    queryClient.invalidateQueries({ queryKey: qk.program(programId) });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.primaryMuscle.includes(q),
    );
  }, [exercises, search]);

  function toggle(id: string) {
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  }

  async function start() {
    if (selected.length === 0 || starting) return;
    setStarting(true);
    const session = await api<{ id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name: "Quick Workout" }),
    });
    await Promise.all(
      selected.map((exerciseId, i) =>
        api(`/api/sessions/${session.id}/exercises`, {
          method: "POST",
          body: JSON.stringify({ exerciseId, order: i + 1 }),
        }),
      ),
    );
    queryClient.invalidateQueries({ queryKey: qk.activeSession });
    router.push(`/workout/${session.id}`);
  }

  async function startRoutine(routineId?: string, programId?: string) {
    if (!routineId || starting) return;
    setStarting(true);
    const s = await api<{ id: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ routineId, programId }),
    });
    queryClient.invalidateQueries({ queryKey: qk.activeSession });
    router.push(`/workout/${s.id}`);
  }

  async function skipDay() {
    if (!activeProgram) return;
    const next = advanceRotation(
      activeProgram.rotationCursor ?? 0,
      programDays.length,
    );
    await api(`/api/programs/${activeProgram.id}`, {
      method: "PUT",
      body: JSON.stringify({ rotationCursor: next }),
    });
    queryClient.invalidateQueries({ queryKey: qk.programs });
    queryClient.invalidateQueries({ queryKey: qk.program(activeProgram.id) });
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 px-5 pt-5 pb-[calc(112px+var(--safe-bottom))]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logo-mark.svg"
            alt=""
            width={34}
            height={34}
            className="block"
          />
          <div className="flex-1">
            <div className="text-2xl font-extrabold leading-none tracking-[-0.01em]">
              Rackd
            </div>
            <div className="text-[var(--text-muted)] text-sm">
              Ready when you are.
            </div>
          </div>
          <Link href="/settings" aria-label="Profile and settings">
            <Avatar
              src={profile?.photoUrl || null}
              name={profile?.displayName}
            />
          </Link>
        </div>

        {/* Active program → drives today's workout */}
        {activeProgram && (
          <Link
            href={`/programs/${activeProgram.id}`}
            className="no-underline block mb-3.5"
          >
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] px-3.5 py-3">
              <div className="flex items-center gap-2.5">
                <Badge tone="accent" solid>
                  Program
                </Badge>
                <span className="font-bold text-[15px] text-[var(--text)] truncate">
                  {activeProgram.name}
                </span>
                <span className="ml-auto shrink-0 text-[var(--text-muted)] text-[13px]">
                  Change ›
                </span>
              </div>
              <ProgramProgress
                program={activeProgram}
                programDays={programDays}
                finished={finished}
              />
            </div>
          </Link>
        )}

        {/* A workout in progress supersedes everything: resume it, don't start
            a duplicate. */}
        {active ? (
          <Card variant="accent" style={{ marginBottom: 24 }}>
            <div className="text-xs font-bold uppercase tracking-[0.06em] opacity-85">
              In progress
            </div>
            <div className="mt-2 text-3xl font-extrabold leading-[1.05]">
              {active.name}
            </div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => router.push(`/workout/${active.id}`)}
              style={{
                marginTop: 18,
                background: "#fff",
                color: "var(--accent)",
                border: "none",
              }}
            >
              Resume workout ›
            </Button>
          </Card>
        ) : !activeProgram ? (
          <Card
            variant="dashed"
            style={{ marginBottom: 24, textAlign: "center", padding: 28 }}
          >
            <div className={EYEBROW}>Get started</div>
            <div className="mt-1.5 text-3xl font-extrabold leading-[1.1]">
              No active program
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {programs.length > 0
                ? "Activate a program to plan your week — or create a new one."
                : "Create a program to plan your training week."}
            </div>

            {programs.length > 0 && (
              <Button
                variant="primary"
                fullWidth
                onClick={() => setActivateOpen(true)}
                style={{ marginTop: 18 }}
              >
                Activate a program
              </Button>
            )}
            <Button
              variant={programs.length > 0 ? "secondary" : "primary"}
              fullWidth
              onClick={() => router.push("/programs")}
              style={
                programs.length > 0
                  ? { marginTop: 10, color: "var(--accent)" }
                  : { marginTop: 18 }
              }
            >
              Create program
            </Button>
          </Card>
        ) : completedToday ? (
          <Card variant="accent" style={{ marginBottom: 24 }}>
            <div className="text-xs font-bold uppercase tracking-[0.06em] opacity-85 whitespace-nowrap">
              Today · done
            </div>
            <div className="mt-2 flex items-baseline gap-2 text-3xl font-extrabold leading-[1.05]">
              Crushed it
              <span aria-hidden="true">💪</span>
            </div>
            <div className="mt-1.5 text-sm font-semibold text-white/85">
              {completedName} complete
            </div>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() =>
                router.push(`/workout/${completedToday.id}/summary`)
              }
              style={{
                marginTop: 18,
                background: "#fff",
                color: "var(--accent)",
                border: "none",
              }}
            >
              See your summary ›
            </Button>
            {heroRoutineId && heroName && (
              <button
                type="button"
                onClick={() => startRoutine(heroRoutineId, activeProgram?.id)}
                disabled={starting}
                className="block w-full mt-2.5 py-1.5 bg-transparent border-none cursor-pointer text-sm font-bold text-white/90 text-center disabled:opacity-60"
              >
                {starting ? "Starting…" : `Train ${heroName} ›`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className="block w-full mt-2 py-1.5 bg-transparent border-none cursor-pointer text-[13px] font-semibold text-white/75 text-center"
            >
              Start quick workout ›
            </button>
          </Card>
        ) : !isRest ? (
          <Card variant="accent" style={{ marginBottom: 24 }}>
            <div className="flex items-center gap-2.5">
              <div className="text-xs font-bold uppercase tracking-[0.06em] opacity-85 whitespace-nowrap">
                Today&apos;s workout
              </div>
              {canSkip && (
                <button
                  type="button"
                  onClick={skipDay}
                  className="ml-auto shrink-0 border-none bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-[var(--radius-pill)] cursor-pointer whitespace-nowrap"
                >
                  Skip ›
                </button>
              )}
            </div>
            <div className="mt-2 text-3xl font-extrabold leading-[1.05]">
              {heroName}
            </div>
            {heroEstimate && (
              <div className="mt-1.5 text-sm font-semibold text-white/85 tabular-nums">
                {heroEstimate.count} exercise
                {heroEstimate.count === 1 ? "" : "s"} · ~{heroEstimate.minutes}{" "}
                min
              </div>
            )}
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => startRoutine(heroRoutineId, activeProgram?.id)}
              disabled={starting}
              style={{
                marginTop: 18,
                background: "#fff",
                color: "var(--accent)",
                border: "none",
              }}
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
          <Card
            variant="dashed"
            style={{ marginBottom: 24, textAlign: "center", padding: 28 }}
          >
            <div className={EYEBROW}>Today</div>
            <div className="mt-1.5 text-3xl font-extrabold leading-[1.1]">
              Rest day
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {nextName
                ? `Recovery is where you grow. Next up: ${nextName}.`
                : "Nothing scheduled — recovery is where you grow."}
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={() => setQuickOpen(true)}
              style={{ marginTop: 18 }}
            >
              Start quick workout
            </Button>

            {nextSlot?.routineId && !skipRevealed && (
              <button
                type="button"
                onClick={() => setSkipRevealed(true)}
                className="block w-full mt-2.5 py-1.5 bg-transparent border-none cursor-pointer text-sm font-bold text-[var(--accent)] text-center"
              >
                Skip rest day ›
              </button>
            )}

            {skipRevealed && nextSlot?.routineId && (
              <div className="mt-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-3.5 text-left">
                <div className={EYEBROW}>Skip the rest — start today</div>
                <div className="mt-1 text-lg font-extrabold leading-tight text-[var(--text)]">
                  {nextName}
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => startRoutine(nextSlot.routineId)}
                  disabled={starting}
                  style={{ marginTop: 12, color: "var(--accent)" }}
                >
                  {starting ? "Starting…" : `Start ${nextName} ›`}
                </Button>
              </div>
            )}
          </Card>
        )}

        <ThisWeekCard />
        <RecentSessionsCard />

      </main>
      <Nav />

      {/* Quick ad-hoc workout — pick exercises to start a session with no routine */}
      <BottomSheet
        open={quickOpen}
        onClose={closeQuick}
        title="Quick workout"
        subtitle={selected.length > 0 ? `${selected.length} selected` : undefined}
      >
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

        {selected.length > 0 && (
          <div className="sticky bottom-0 -mx-4 mt-2 px-4 pt-3 pb-1 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
            <Button variant="primary" size="lg" fullWidth onClick={start} disabled={starting}>
              {starting ? "Starting…" : `Start workout (${selected.length})`}
            </Button>
          </div>
        )}
      </BottomSheet>

      <ActivateProgramSheet
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        programs={programChoices}
        onSelect={activateProgram}
      />
    </div>
  );
}
