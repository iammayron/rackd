"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  renameProgram,
  addProgramDay,
  setProgramActive,
  setProgramSchedule,
  createRoutine,
  duplicateRoutine,
  updateProgramDay,
  removeProgramDay,
  reorderProgramDays,
  deleteProgram,
} from "@rackd/db";
import { Badge, SegmentedControl } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/components/toast/ToastProvider";
import { BottomSheet } from "@/components/BottomSheet";
import { BackButton } from "@/components/BackButton";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  ActivateProgramSheet,
  type ProgramChoice,
} from "@/components/ActivateProgramSheet";
import { ProgramDayRow } from "@/features/programs/ProgramDayRow";
import { ProgramDaySheet, type RoutineChoice } from "@/features/programs/ProgramDaySheet";

interface ProgramRow {
  id: string;
  name: string;
  active?: boolean;
  scheduleMode?: "rotation" | "weekly";
  rotationCursor?: number;
  blockWeeks?: number;
}
interface DayRow {
  id: string;
  order: number;
  name: string;
  routineId?: string;
  weekday?: number;
}
interface RoutineRow {
  id: string;
  name: string;
  category?: string;
}
interface RoutineExerciseRow {
  id: string;
  routineId: string;
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-semibold uppercase tracking-[0.06em]";

/** Fixed-weekly week, Mon-first; values follow Date.getDay() (0=Sun…6=Sat). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Block-length presets; `undefined` = Ongoing (no block / deload). */
const BLOCK_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: "4 weeks", value: 4 },
  { label: "6 weeks", value: 6 },
  { label: "8 weeks", value: 8 },
  { label: "12 weeks", value: 12 },
  { label: "Ongoing", value: undefined },
];

/**
 * Derive a short focus tag (Push/Pull/Legs/…) from a routine name. Fallback for
 * routines without an explicit `category`; returns null when nothing matches so
 * we omit the tag rather than fabricate one. Mirrors the Plans list helper.
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

export default function ProgramEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const programId = params.id;

  const { results: program } = useQuery<ProgramRow>(
    (c) => c.query("programs").Where("id", "=", programId),
    [programId],
  );
  const p = program[0];
  const name = p?.name ?? "";
  const mode = p?.scheduleMode ?? "rotation";
  const blockWeeks = p?.blockWeeks ?? 0;

  const { results: days } = useQuery<DayRow>(
    (c) => c.query("programDays").Where("programId", "=", programId).Order("order", "ASC"),
    [programId],
  );
  const { results: routines } = useQuery<RoutineRow>((c) => c.query("routines").Order("name", "ASC"));
  const { results: routineExercises } = useQuery<RoutineExerciseRow>((c) =>
    c.query("routineExercises"),
  );
  const { results: allPrograms } = useQuery<ProgramRow>((c) =>
    c.query("programs").Order("order", "ASC"),
  );
  // All of the owner's program days (Triplit is owner-scoped), used to detect
  // when a routine is shared by 2+ programs — the only case where the edit
  // scope (everywhere vs fork) actually matters.
  const { results: allProgramDays } = useQuery<{
    id: string;
    programId: string;
    routineId?: string;
  }>((c) => c.query("programDays"));

  // After deleting the active program, prompt to activate one of the survivors.
  const [postDeleteChoices, setPostDeleteChoices] = useState<ProgramChoice[] | null>(null);

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

  // Weekly mode: first program day pinned to each weekday (0=Sun…6=Sat). First
  // match wins so a stray duplicate weekday can't render two rows.
  const dayByWeekday = useMemo(() => {
    const m = new Map<number, DayRow>();
    for (const d of days) if (d.weekday != null && !m.has(d.weekday)) m.set(d.weekday, d);
    return m;
  }, [days]);

  // Every routine the sheet can assign (name + exercise count).
  const routineChoices: RoutineChoice[] = useMemo(
    () => routines.map((r) => ({ id: r.id, name: r.name, exCount: exCountByRoutine.get(r.id) ?? 0 })),
    [routines, exCountByRoutine],
  );

  // Distinct routines actually used by this program's days, first-seen order.
  const programRoutines = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; focus: string | null; exCount: number }[] = [];
    for (const d of days) {
      if (!d.routineId || seen.has(d.routineId)) continue;
      seen.add(d.routineId);
      const r = routineById.get(d.routineId);
      if (!r) continue;
      out.push({
        id: r.id,
        name: r.name,
        focus: r.category?.trim() || splitLabel(r.name),
        exCount: exCountByRoutine.get(r.id) ?? 0,
      });
    }
    return out;
  }, [days, routineById, exCountByRoutine]);

  // The day/weekday assignment sheet picks from THIS program's routine pool
  // (plus Rest) — not the whole library. Pulling in outside routines is done
  // only via the library-scoped "Add existing" picker below.
  const programRoutineChoices: RoutineChoice[] = useMemo(
    () => programRoutines.map((r) => ({ id: r.id, name: r.name, exCount: r.exCount })),
    [programRoutines],
  );

  const workoutDayCount = days.filter((d) => d.routineId).length;

  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  // Tap-to-edit rows in the PROGRAM card.
  const [editingName, setEditingName] = useState(false);
  const [weeksSheetOpen, setWeeksSheetOpen] = useState(false);

  function commitName() {
    const next = draftName.trim();
    if (next) renameProgram(getClient(), programId, next);
    else setDraftName(name);
    setEditingName(false);
  }

  /** Set the block length from a preset; `undefined` = Ongoing (no block). */
  function setBlock(weeks: number | undefined) {
    void setProgramSchedule(getClient(), programId, { blockWeeks: weeks });
    setWeeksSheetOpen(false);
  }

  // ── Drag-to-reorder (pointer-based, works on touch + mouse) ──────────────
  // `dragOrder` is the optimistic id sequence while dragging (null = follow the
  // query). A ref mirrors it so the pointer handlers read the latest order
  // without re-binding. Once the persisted query catches up, we drop the
  // override so a refetch/sync can't fight the local state.
  const listRef = useRef<HTMLDivElement>(null);
  const [dragOrder, setDragOrderState] = useState<string[] | null>(null);
  const dragOrderRef = useRef<string[] | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const setDragOrder = (next: string[] | null) => {
    dragOrderRef.current = next;
    setDragOrderState(next);
  };

  const orderedDays = useMemo(() => {
    if (!dragOrder) return days;
    const byId = new Map(days.map((d) => [d.id, d]));
    const arr = dragOrder.map((id) => byId.get(id)).filter(Boolean) as DayRow[];
    return arr.length === days.length ? arr : days;
  }, [dragOrder, days]);

  // Clear the optimistic override once the query reflects the persisted order —
  // but never mid-drag (at drag start the override equals the query order, and
  // dropping it then would abort the gesture).
  useEffect(() => {
    if (!dragOrder || draggingIdRef.current) return;
    if (days.map((d) => d.id).join(",") === dragOrder.join(",")) setDragOrder(null);
  }, [days, dragOrder]);

  function startDrag(e: PointerEvent, dayId: string) {
    e.preventDefault();
    const ids = orderedDays.map((d) => d.id);
    setDragOrder(ids);
    draggingIdRef.current = dayId;
    setDraggingId(dayId);
    // Capture so pointermove/up keep firing on the grip even as the finger
    // slides over other rows. Guarded — not all environments allow it.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore — capture is a nicety, the handlers still work without it */
    }
  }

  function moveDrag(e: PointerEvent) {
    const id = draggingIdRef.current;
    const prev = dragOrderRef.current;
    const container = listRef.current;
    if (id == null || !prev || !container) return;
    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-day-id]"));
    const centers = rows.map((r) => {
      const rect = r.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    const y = e.clientY;
    let toIndex = prev.length - 1;
    for (let i = 0; i < centers.length; i++) {
      if (y < centers[i]!) {
        toIndex = i;
        break;
      }
    }
    const fromIndex = prev.indexOf(id);
    if (fromIndex === -1) return;
    const insert = toIndex > fromIndex ? toIndex - 1 : toIndex;
    if (insert === fromIndex) return;
    const next = [...prev];
    next.splice(fromIndex, 1);
    next.splice(insert, 0, id);
    setDragOrder(next);
  }

  function endDrag() {
    const id = draggingIdRef.current;
    draggingIdRef.current = null;
    setDraggingId(null);
    if (id == null) return;
    const finalOrder = dragOrderRef.current;
    // Persist only when the sequence actually changed.
    if (finalOrder && finalOrder.join(",") !== days.map((d) => d.id).join(",")) {
      void reorderProgramDays(getClient(), finalOrder);
    } else {
      setDragOrder(null);
    }
  }

  // Assignment sheet target. Rotation opens by program-day id; weekly opens by
  // weekday (the day may not exist yet). Only one is active per mode.
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [openWeekday, setOpenWeekday] = useState<number | null>(null);
  const openDay = openDayId ? orderedDays.find((d) => d.id === openDayId) ?? null : null;
  const openDayNumber = openDayId ? orderedDays.findIndex((d) => d.id === openDayId) + 1 : 0;

  const sheetOpen = mode === "weekly" ? openWeekday != null : openDayId != null;
  const sheetDay =
    mode === "weekly"
      ? openWeekday != null
        ? dayByWeekday.get(openWeekday) ?? null
        : null
      : openDay;
  const sheetTitle =
    mode === "weekly"
      ? openWeekday != null
        ? WEEKDAY_FULL[openWeekday]!
        : ""
      : `Day ${openDayNumber}`;

  function closeSheet() {
    setOpenDayId(null);
    setOpenWeekday(null);
  }

  async function addDay() {
    if (days.length >= 7) return;
    await addProgramDay(getClient(), { programId, order: days.length + 1 });
  }

  // Edit scope is chosen up front (Option A, "fork on entry") and reused by
  // every in-program entry into the routine editor. When a routine lives in
  // only this program, editing the shared routine affects nothing else, so we
  // open it directly. When it's shared by 2+ programs we ask: edit everywhere,
  // or fork a copy just for this program.
  const [scopeRoutineId, setScopeRoutineId] = useState<string | null>(null);

  function isSharedAcrossPrograms(routineId: string): boolean {
    const owners = new Set<string>();
    for (const d of allProgramDays) if (d.routineId === routineId) owners.add(d.programId);
    return [...owners].some((pid) => pid !== programId);
  }

  function openRoutineForEdit(routineId: string) {
    if (isSharedAcrossPrograms(routineId)) setScopeRoutineId(routineId);
    else router.push(`/routines/${routineId}?programId=${programId}`);
  }

  /**
   * Fork a routine into an independent copy and repoint every day in THIS
   * program that references it (leaving the shared routine + other programs
   * untouched), then open the copy's editor. Reuses `duplicateRoutine` — the
   * same logic the old "Edit here only" used.
   */
  async function editOnlyThisProgram(routineId: string) {
    const copyId = await duplicateRoutine(getClient(), {
      routineId,
      ownerId: getCurrentUserId(),
    });
    if (!copyId) return;
    const refs = days.filter((d) => d.routineId === routineId);
    await Promise.all(refs.map((d) => updateProgramDay(getClient(), d.id, { routineId: copyId })));
    router.push(`/routines/${copyId}?programId=${programId}`);
  }

  /** Rotation: assign/clear the routine on the open program day. */
  function assignRoutine(routineId: string | undefined) {
    if (!openDayId) return;
    void updateProgramDay(getClient(), openDayId, { routineId });
    setOpenDayId(null);
  }

  /**
   * Weekly: map a routine (or Rest) onto a weekday. Reuse the weekday's existing
   * program day if there is one; otherwise create it. Rest removes the day so we
   * never accumulate empty or duplicate weekday rows.
   */
  async function assignWeekday(weekday: number, routineId: string | undefined) {
    const existing = dayByWeekday.get(weekday);
    if (routineId === undefined) {
      if (existing) await removeProgramDay(getClient(), existing.id);
    } else if (existing) {
      await updateProgramDay(getClient(), existing.id, { routineId });
    } else {
      await addProgramDay(getClient(), {
        programId,
        order: days.length + 1,
        weekday,
        routineId,
      });
    }
    setOpenWeekday(null);
  }

  function onSheetAssign(routineId: string | undefined) {
    if (mode === "weekly") {
      if (openWeekday != null) void assignWeekday(openWeekday, routineId);
    } else {
      assignRoutine(routineId);
    }
  }

  /** Fill empty (Rest) days by cycling through the routines already in use. */
  async function autoFill() {
    const pool = programRoutines.map((r) => r.id);
    if (pool.length === 0) {
      toast.info("Assign a routine to a day first, then auto-fill the rest.");
      return;
    }
    const empties = days.filter((d) => !d.routineId);
    if (empties.length === 0) {
      toast.info("Every day already has a routine.");
      return;
    }
    await Promise.all(
      empties.map((d, i) =>
        updateProgramDay(getClient(), d.id, { routineId: pool[i % pool.length] }),
      ),
    );
  }

  // ── Add / remove routines in the program ─────────────────────────────────
  // Membership is implied by days, so "add" = give the routine a slot and
  // "remove" = detach it from every day that references it (the routine itself
  // stays in the library). The Add affordance is a two-step sheet: choose New
  // vs. existing, then (for existing) pick from routines not already used here.
  const [addStep, setAddStep] = useState<null | "choose" | "existing">(null);

  const programRoutineIds = useMemo(
    () => new Set(programRoutines.map((r) => r.id)),
    [programRoutines],
  );
  const addableRoutines = useMemo(
    () => routineChoices.filter((r) => !programRoutineIds.has(r.id)),
    [routineChoices, programRoutineIds],
  );

  // Is there room for one more routine? Rotation caps at 7 days; weekly caps at
  // one routine per weekday (7).
  const firstFreeWeekday = WEEK_ORDER.find((wd) => !dayByWeekday.get(wd));
  const programFull = mode === "weekly" ? firstFreeWeekday === undefined : days.length >= 7;

  /** Give a routine a slot in this program. Returns false (with a toast) when full. */
  async function addRoutineToProgram(routineId: string): Promise<boolean> {
    if (mode === "weekly") {
      if (firstFreeWeekday === undefined) {
        toast.info("Every weekday is filled. Free one up first.");
        return false;
      }
      await addProgramDay(getClient(), {
        programId,
        order: days.length + 1,
        weekday: firstFreeWeekday,
        routineId,
      });
    } else {
      if (days.length >= 7) {
        toast.info("This program is full (7 days max). Remove a day first.");
        return false;
      }
      await addProgramDay(getClient(), { programId, order: days.length + 1, routineId });
    }
    return true;
  }

  async function addExistingRoutine(routineId: string) {
    if (await addRoutineToProgram(routineId)) setAddStep(null);
  }

  /** Create a brand-new routine, slot it in, and open its editor. */
  async function createAndAddRoutine() {
    if (programFull) {
      toast.info(
        mode === "weekly"
          ? "Every weekday is filled. Free one up first."
          : "This program is full (7 days max). Remove a day first.",
      );
      return;
    }
    const r = await createRoutine(getClient(), {
      ownerId: getCurrentUserId(),
      name: "New Routine",
      order: routines.length,
    });
    await addRoutineToProgram(r.id);
    setAddStep(null);
    router.push(`/routines/${r.id}?programId=${programId}`);
  }

  /** Detach a routine from THIS program by removing every day that references it. */
  async function detachRoutine(routineId: string, routineName: string) {
    const ok = await confirm({
      title: `Remove "${routineName}"?`,
      message: "This removes it from this program. The routine itself is kept.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    const refs = days.filter((d) => d.routineId === routineId);
    await Promise.all(refs.map((d) => removeProgramDay(getClient(), d.id)));
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-1 border-b border-[var(--border)] bg-[var(--bg)] px-2 py-2">
        <BackButton href="/programs" />
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => draftName.trim() && renameProgram(getClient(), programId, draftName.trim())}
          aria-label="Program name"
          className="min-w-0 flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        {p?.active ? (
          <Badge tone="accent" solid style={{ marginRight: 4 }}>
            Active
          </Badge>
        ) : (
          <button
            type="button"
            onClick={() => setProgramActive(getClient(), { programId, ownerId: getCurrentUserId() })}
            className="shrink-0 px-1 text-sm font-bold text-[var(--accent)]"
          >
            Set active
          </button>
        )}
      </header>

      <main className="flex-1 px-5 pt-4 pb-24">
        {/* Meta line — days/wk, and block length only when set. */}
        <div className="mb-4 text-sm text-[var(--text-muted)]">
          {workoutDayCount} day{workoutDayCount === 1 ? "" : "s"}/wk
          {blockWeeks ? ` · ${blockWeeks}-week block` : ""}
        </div>

        {/* Schedule mode */}
        <div className={`${EYEBROW} mb-2`}>Schedule</div>
        <SegmentedControl
          fullWidth
          value={mode}
          options={[
            { value: "rotation", label: "Rotation" },
            { value: "weekly", label: "Fixed weekly" },
          ]}
          onChange={(m) =>
            setProgramSchedule(getClient(), programId, {
              scheduleMode: m as "rotation" | "weekly",
            })
          }
          style={{ marginBottom: 8 }}
        />
        <p className="text-sm text-[var(--text-muted)] mb-5">
          {mode === "rotation"
            ? "Repeats in order, ignoring the calendar. Add a Rest slot anywhere."
            : "Each day maps to a weekday. Days with no routine are rest days."}
        </p>

        {mode === "weekly" ? (
          /* Fixed week: always 7 weekday rows (Mon→Sun). No grip / × / Add-day —
             the week is fixed and Rest is the empty state. Tap to assign. */
          <div>
            {WEEK_ORDER.map((wd) => {
              const d = dayByWeekday.get(wd);
              const routineName = d?.routineId ? routineById.get(d.routineId)?.name : undefined;
              return (
                <button
                  key={wd}
                  type="button"
                  onClick={() => setOpenWeekday(wd)}
                  className="rk-squircle-corners mb-2.5 flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left"
                >
                  <span className="w-12 shrink-0 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {WEEKDAY_ABBR[wd]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--text)]">
                    {routineName ?? "Rest"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            {/* Day rows — tap to assign a routine via the bottom sheet; drag the
                `::` grip to reorder. */}
            <div ref={listRef}>
              {orderedDays.map((d, i) => (
                <ProgramDayRow
                  key={d.id}
                  day={d}
                  dayNumber={i + 1}
                  mode={mode}
                  routineName={d.routineId ? routineById.get(d.routineId)?.name : undefined}
                  dragging={draggingId === d.id}
                  onOpen={() => setOpenDayId(d.id)}
                  onRemove={() => removeProgramDay(getClient(), d.id)}
                  onGripPointerDown={(e) => startDrag(e, d.id)}
                  onGripPointerMove={moveDrag}
                  onGripPointerUp={endDrag}
                />
              ))}
            </div>

            {days.length < 7 && (
              <button
                type="button"
                onClick={addDay}
                className="rk-squircle-corners mt-1 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-4 text-center font-bold text-[var(--accent)]"
              >
                + Add day
              </button>
            )}

            <button
              type="button"
              onClick={autoFill}
              className="mx-auto mt-4 block bg-transparent text-center text-sm font-semibold text-[var(--text-muted)]"
            >
              ↻ Auto-fill from this program&apos;s routines
            </button>
          </>
        )}

        {/* Routines used across the program's days — add new/existing, or detach. */}
        <section className="mt-8">
          <div className={`${EYEBROW} mb-3`}>Routines in this program</div>
          {programRoutines.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {programRoutines.map((r) => (
                <li
                  key={r.id}
                  className="rk-squircle-corners flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
                >
                  <button
                    type="button"
                    onClick={() => openRoutineForEdit(r.id)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 py-3.5 ps-4 pe-2 text-left"
                  >
                    <span className="min-w-0 truncate font-bold text-[var(--text)]">{r.name}</span>
                    <span className="shrink-0 text-sm text-[var(--text-muted)]">
                      {r.focus ? `${r.focus} · ` : ""}
                      {r.exCount} exercise{r.exCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => detachRoutine(r.id, r.name)}
                    aria-label={`Remove ${r.name} from this program`}
                    className="rk-squircle-corners me-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-xl leading-none text-[var(--danger)]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setAddStep("choose")}
            className="rk-squircle-corners mt-2.5 w-full rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-4 text-center font-bold text-[var(--accent)]"
          >
            + Add routine
          </button>
        </section>

        {/* Program-level settings + destructive actions. */}
        <section className="mt-8">
          <div className={`${EYEBROW} mb-3`}>Program</div>

          <div className="rk-squircle-corners overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
            {/* Rename — tap to edit inline; persists via renameProgram. */}
            {editingName ? (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="shrink-0 font-bold text-[var(--text)]">Rename program</span>
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      setDraftName(name);
                      setEditingName(false);
                    }
                  }}
                  aria-label="Program name"
                  className="ms-auto min-w-0 flex-1 bg-transparent text-right text-[var(--text)] focus:outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="shrink-0 font-bold text-[var(--text)]">Rename program</span>
                <span className="ms-auto min-w-0 truncate text-[var(--text-muted)]">{name}</span>
                <span className="shrink-0 leading-none text-[var(--text-muted)]">›</span>
              </button>
            )}

            <div className="h-px bg-[var(--border)]" />

            {/* Block length — tap to open the preset picker (bottom sheet). */}
            <button
              type="button"
              onClick={() => setWeeksSheetOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[var(--text)]">Block length</div>
                <div className="text-sm text-[var(--text-muted)]">
                  Weeks before the program repeats or deloads
                </div>
              </div>
              <span className="ms-auto shrink-0 font-bold" style={{ color: "var(--accent)" }}>
                {blockWeeks ? `${blockWeeks} week${blockWeeks === 1 ? "" : "s"}` : "Ongoing"}
              </span>
            </button>
          </div>

          {/* Off the Plans list so it can't be hit by accident. Removes the
              program + its days; the underlying routines are kept. */}
          <button
            type="button"
            onClick={async () => {
              const ok = await confirm({
                title: "Delete this program?",
                message: "Your routines are kept.",
                confirmLabel: "Delete",
              });
              if (!ok) return;
              const wasActive = !!p?.active;
              const others = allPrograms.filter((x) => x.id !== programId);
              await deleteProgram(getClient(), programId);

              // Deleting the active program leaves no "today" — help the user pick
              // a replacement (or create one) instead of silently navigating away.
              if (wasActive && others.length > 0) {
                setPostDeleteChoices(
                  others.map((x) => ({
                    id: x.id,
                    name: x.name,
                    meta:
                      (x.scheduleMode ?? "rotation") === "weekly"
                        ? "Fixed weekly"
                        : "Rotation",
                  })),
                );
                return;
              }
              if (wasActive && others.length === 0) {
                const create = await confirm({
                  title: "No programs left",
                  message: "Create a new program to plan your training?",
                  confirmLabel: "Create",
                  cancelLabel: "Not now",
                });
                router.push(create ? "/programs" : "/");
                return;
              }
              router.push("/programs");
            }}
            className="mt-4 w-full bg-transparent border-none py-2 text-center text-sm font-semibold text-[var(--danger)]"
          >
            Delete program
          </button>
        </section>
      </main>

      <ProgramDaySheet
        open={sheetOpen}
        onClose={closeSheet}
        day={sheetDay}
        title={sheetTitle}
        routines={programRoutineChoices}
        onAssign={onSheetAssign}
        onEdit={(routineId) => {
          closeSheet();
          openRoutineForEdit(routineId);
        }}
      />

      <BottomSheet
        open={addStep === "choose"}
        onClose={() => setAddStep(null)}
        title="Add routine"
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          <li>
            <button
              type="button"
              onClick={createAndAddRoutine}
              className="rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left"
            >
              <span className="font-bold text-[var(--text)]">New routine</span>
              <span className="shrink-0 text-sm text-[var(--text-muted)]">Create &amp; edit</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setAddStep("existing")}
              className="rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left"
            >
              <span className="font-bold text-[var(--text)]">Add existing routine</span>
              <span className="shrink-0 text-sm text-[var(--text-muted)]">›</span>
            </button>
          </li>
        </ul>
      </BottomSheet>

      <BottomSheet
        open={addStep === "existing"}
        onClose={() => setAddStep(null)}
        title="Add existing routine"
      >
        {addableRoutines.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-[var(--text-muted)]">
            Every routine in your library is already in this program.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {addableRoutines.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => addExistingRoutine(r.id)}
                  className="rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-left"
                >
                  <span className="min-w-0 truncate font-bold text-[var(--text)]">{r.name}</span>
                  <span className="shrink-0 text-sm text-[var(--text-muted)]">
                    {r.exCount} exercise{r.exCount === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      <BottomSheet
        open={weeksSheetOpen}
        onClose={() => setWeeksSheetOpen(false)}
        title="Block length"
      >
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {BLOCK_OPTIONS.map((opt) => {
            const selected = (blockWeeks || undefined) === opt.value;
            return (
              <li key={opt.label}>
                <button
                  type="button"
                  onClick={() => setBlock(opt.value)}
                  aria-pressed={selected}
                  className={`rk-squircle-corners flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-3.5 text-left ${
                    selected
                      ? "border-transparent bg-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--surface)]"
                  }`}
                >
                  <span
                    className="font-bold"
                    style={{ color: selected ? "var(--text-on-accent)" : "var(--text)" }}
                  >
                    {opt.label}
                  </span>
                  {opt.value === undefined && (
                    <span
                      className="text-sm"
                      style={
                        selected
                          ? { color: "var(--text-on-accent)", opacity: 0.85 }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      No deload
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      <ActivateProgramSheet
        open={postDeleteChoices !== null}
        onClose={() => {
          setPostDeleteChoices(null);
          router.push("/programs");
        }}
        programs={postDeleteChoices ?? []}
        title="Activate another program"
        onSelect={async (id) => {
          await setProgramActive(getClient(), { programId: id, ownerId: getCurrentUserId() });
          setPostDeleteChoices(null);
          router.push("/programs");
        }}
      />

      <BottomSheet
        open={scopeRoutineId !== null}
        onClose={() => setScopeRoutineId(null)}
        title="Edit routine"
      >
        <p className="px-1 pb-3 text-sm text-[var(--text-muted)]">
          This routine is used by other programs. Edit it everywhere, or make a copy just for this
          program?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              const rid = scopeRoutineId;
              setScopeRoutineId(null);
              if (rid) router.push(`/routines/${rid}?programId=${programId}`);
            }}
            className="rk-squircle-corners w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-3.5 text-center font-bold text-[var(--text)]"
          >
            Edit everywhere
          </button>
          <button
            type="button"
            onClick={() => {
              const rid = scopeRoutineId;
              setScopeRoutineId(null);
              if (rid) void editOnlyThisProgram(rid);
            }}
            className="rk-squircle-corners w-full rounded-[var(--radius-md)] bg-[var(--accent)] py-3.5 text-center font-bold text-[var(--text-on-accent)]"
          >
            Only this program
          </button>
        </div>
      </BottomSheet>

      {confirmDialog}
    </div>
  );
}
