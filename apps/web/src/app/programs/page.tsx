"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createProgram,
  createRoutine,
  setProgramActive,
  PROGRAM_TEMPLATES,
  cloneProgramTemplate,
} from "@rackd/db";
import { Card, Button, Badge, SegmentedControl } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { Nav } from "@/components/Nav";

interface ProgramRow {
  id: string;
  name: string;
  order: number;
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  rotationCursor?: number;
  blockWeeks?: number;
}
interface DayRow {
  id: string;
  programId: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}
interface RoutineRow {
  id: string;
  name: string;
  order: number;
  category?: string;
}
interface RoutineExerciseRow {
  id: string;
  routineId: string;
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Derive a short split tag (Push/Pull/Legs/Upper/…) from a routine/day name.
 * Fallback for routines without an explicit `category`; returns null when
 * nothing matches so we omit the tag rather than fabricate one.
 */
function splitLabel(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("push")) return "Push";
  if (n.includes("pull")) return "Pull";
  if (n.includes("leg")) return "Legs";
  if (n.includes("upper")) return "Upper";
  if (n.includes("lower")) return "Lower";
  if (n.includes("full")) return "Full body";
  if (n.includes("arm")) return "Arms";
  if (n.includes("chest")) return "Chest";
  if (n.includes("back")) return "Back";
  if (n.includes("shoulder")) return "Shoulders";
  if (n.includes("core") || n.includes("abs")) return "Core";
  return null;
}

/** Longest run of consecutive workout (non-rest) days in a rotation cycle,
 *  measured cyclically since the cycle wraps around. */
function longestWorkoutRun(isWorkout: boolean[]): number {
  const n = isWorkout.length;
  if (n === 0) return 0;
  if (isWorkout.every(Boolean)) return n;
  let best = 0;
  let run = 0;
  for (let i = 0; i < n * 2; i++) {
    if (isWorkout[i % n]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return Math.min(best, n);
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

export default function ProgramsPage() {
  const router = useRouter();

  const { results: programs } = useQuery<ProgramRow>((c) =>
    c.query("programs").Order("order", "ASC"),
  );
  const { results: days } = useQuery<DayRow>((c) =>
    c.query("programDays").Order("order", "ASC"),
  );
  const { results: routines } = useQuery<RoutineRow>((c) =>
    c.query("routines").Order("order", "ASC"),
  );
  const { results: routineExercises } = useQuery<RoutineExerciseRow>((c) =>
    c.query("routineExercises"),
  );

  const [tab, setTab] = useState<"programs" | "routines">("programs");
  const [browsing, setBrowsing] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [busy, setBusy] = useState(false);

  const exCountByRoutine = useMemo(() => {
    const m = new Map<string, number>();
    for (const re of routineExercises) m.set(re.routineId, (m.get(re.routineId) ?? 0) + 1);
    return m;
  }, [routineExercises]);

  const routineById = useMemo(() => {
    const m = new Map<string, RoutineRow>();
    for (const r of routines) m.set(r.id, r);
    return m;
  }, [routines]);

  const daysByProgram = useMemo(() => {
    const m = new Map<string, DayRow[]>();
    for (const d of days) {
      const arr = m.get(d.programId) ?? [];
      arr.push(d);
      m.set(d.programId, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.order - b.order);
    return m;
  }, [days]);

  /** Build the display model for one program card from the loaded rows. */
  function programView(p: ProgramRow) {
    const pdays = daysByProgram.get(p.id) ?? [];
    const mode = p.scheduleMode ?? "rotation";
    const workoutDays = pdays.filter((d) => d.routineId);
    const distinctRoutines = new Set(workoutDays.map((d) => d.routineId as string));

    let schedule: string;
    if (mode === "weekly") {
      const letters = pdays
        .filter((d) => d.routineId && d.weekday != null)
        .sort((a, b) => (a.weekday as number) - (b.weekday as number))
        .map((d) => WEEKDAY_LETTERS[d.weekday as number]);
      schedule = letters.length ? `Weekly · trains ${letters.join(" ")}` : "Weekly";
    } else {
      const cycleLength = pdays.length;
      const onRun = longestWorkoutRun(pdays.map((d) => !!d.routineId));
      schedule = cycleLength
        ? `Rotation · ${cycleLength}-day cycle, ${onRun} on`
        : "Rotation";
    }

    // Meta line — only segments backed by real data.
    const meta: string[] = [];
    if (p.blockWeeks) meta.push(`${p.blockWeeks}-week block`);
    if (workoutDays.length) meta.push(`${workoutDays.length} days/wk`);
    if (distinctRoutines.size)
      meta.push(`${distinctRoutines.size} routine${distinctRoutines.size === 1 ? "" : "s"}`);

    const rows = workoutDays.map((d) => {
      const r = d.routineId ? routineById.get(d.routineId) : undefined;
      const title = r?.name ?? d.name;
      const exCount = d.routineId ? exCountByRoutine.get(d.routineId) ?? 0 : 0;
      // Prefer the routine's explicit category tag; fall back to deriving one
      // from the routine/day name so existing (un-tagged) data still shows a tag.
      const tag = r?.category?.trim() || splitLabel(title);
      return { id: d.id, title, exCount, tag };
    });

    return { meta, schedule, rows };
  }

  async function newProgram() {
    if (busy) return;
    setBusy(true);
    const p = await createProgram(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Program",
      order: programs.length,
    });
    router.push(`/programs/${p.id}`);
  }

  async function newRoutine() {
    if (busy) return;
    setBusy(true);
    const r = await createRoutine(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Routine",
      order: routines.length,
    });
    router.push(`/routines/${r.id}`);
  }

  function onNew() {
    if (tab === "programs") void newProgram();
    else void newRoutine();
  }

  function activate(programId: string) {
    return setProgramActive(getClient(), { programId, ownerId: getCurrentUserId() });
  }

  async function useTemplate(templateId: string) {
    if (cloning) return;
    const tpl = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setCloning(true);
    const id = await cloneProgramTemplate(getClient(), tpl, getCurrentUserId());
    router.push(`/programs/${id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 px-5 pt-5 pb-[calc(96px+var(--safe-bottom))]">
        <div className="flex items-center gap-3 mb-5">
          <h1 className="text-2xl font-extrabold">Plans</h1>
          <Button
            variant="primary"
            size="sm"
            className="ms-auto"
            onClick={onNew}
            disabled={busy}
          >
            + New
          </Button>
        </div>

        <SegmentedControl
          fullWidth
          value={tab}
          options={[
            { value: "programs", label: "Programs" },
            { value: "routines", label: "Routines" },
          ]}
          onChange={(v) => setTab(v as "programs" | "routines")}
          style={{ marginBottom: 20 }}
        />

        {tab === "programs" ? (
          <>
            {programs.length === 0 && (
              <Card variant="dashed" style={{ textAlign: "center", padding: 28, marginBottom: 16 }}>
                <div className="text-lg font-bold mb-1">No programs yet</div>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Group your routines into a weekly plan — like Push / Pull / Legs.
                </p>
                <Button variant="primary" fullWidth onClick={() => setBrowsing(true)}>
                  Browse templates
                </Button>
              </Card>
            )}

            <ul className="list-none p-0 m-0 flex flex-col gap-4">
              {programs.map((p) => {
                const v = programView(p);
                return (
                  <li key={p.id}>
                    <Card
                      padding={0}
                      style={
                        p.active
                          ? {
                              borderRadius: "56px",
                              borderColor: "var(--accent)",
                              boxShadow: "0 0 0 1px var(--accent)",
                            }
                          : { borderRadius: "56px" }
                      }
                    >
                      <Link
                        href={`/programs/${p.id}`}
                        className="no-underline block px-5 pt-5 pb-3"
                      >
                        <div className="flex items-center gap-2">
                          <h2 className="flex-1 text-lg font-extrabold text-[var(--text)]">
                            {p.name}
                          </h2>
                          {p.active && (
                            <Badge tone="accent" solid>
                              Active
                            </Badge>
                          )}
                          <span className="text-[var(--text-muted)] text-lg leading-none">
                            ›
                          </span>
                        </div>
                        {v.meta.length > 0 && (
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            {v.meta.join(" · ")}
                          </div>
                        )}
                        <div className="mt-0.5 text-sm font-semibold text-[var(--accent)]">
                          {v.schedule}
                        </div>
                      </Link>

                      {v.rows.length > 0 && (
                        <ul className="list-none p-0 m-0 px-3 pb-3 flex flex-col gap-2">
                          {v.rows.map((row) => (
                            <li
                              key={row.id}
                              className="flex items-center gap-2 rounded-[var(--radius)] bg-[var(--surface-2)] px-3.5 py-3"
                            >
                              <span className="font-bold text-[var(--text)]">{row.title}</span>
                              <span className="text-sm text-[var(--text-muted)]">
                                · {row.exCount} ex
                              </span>
                              {row.tag && (
                                <span className="ms-auto text-sm text-[var(--text-muted)]">
                                  {row.tag}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}

                      {!p.active && (
                        <div className="px-3 pb-3">
                          <Button variant="secondary" fullWidth onClick={() => activate(p.id)}>
                            Set as active
                          </Button>
                        </div>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>

            {programs.length > 0 && (
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => setBrowsing(true)}
                style={{ marginTop: 16, borderStyle: "dashed", color: "var(--accent)" }}
              >
                Browse templates
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="text-sm text-[var(--text-muted)] mb-3">
              {routines.length} saved · build &amp; edit your workouts
            </div>

            {routines.length === 0 && (
              <Card variant="dashed" style={{ textAlign: "center", padding: 28 }}>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  No routines yet. Create one to run the same workout each week.
                </p>
                <Button variant="primary" fullWidth onClick={newRoutine} disabled={busy}>
                  + New routine
                </Button>
              </Card>
            )}

            <ul className="list-none p-0 m-0 flex flex-col gap-2">
              {routines.map((r) => {
                const count = exCountByRoutine.get(r.id) ?? 0;
                return (
                  <li key={r.id}>
                    <Link href={`/routines/${r.id}`} className="no-underline block">
                      <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="flex-1">
                          <div className="font-bold text-[var(--text)]">{r.name}</div>
                          <div className="text-sm text-[var(--text-muted)]">{count} ex</div>
                        </div>
                        <span className="text-[var(--text-muted)] text-lg leading-none">›</span>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => router.push("/discover")}
              style={{ marginTop: 16, color: "var(--accent)" }}
            >
              Discover routines
            </Button>
          </>
        )}
      </main>
      <Nav />

      {browsing && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--bg)]">
          <header className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
            <h2 className="flex-1 text-lg font-bold">Templates</h2>
            <Button variant="secondary" size="sm" onClick={() => setBrowsing(false)}>
              Close
            </Button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {PROGRAM_TEMPLATES.map((t) => (
              <Card key={t.id} variant="feature">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold flex-1">{t.name}</h3>
                  <Badge tone="accent">{t.days.length} days</Badge>
                </div>
                <p className="text-sm text-[var(--text-muted)] mb-2">{t.description}</p>
                <p className={`${EYEBROW} mb-3`}>{t.days.map((d) => d.name).join(" · ")}</p>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => useTemplate(t.id)}
                  disabled={cloning}
                >
                  {cloning ? "Adding…" : "Use this program"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
