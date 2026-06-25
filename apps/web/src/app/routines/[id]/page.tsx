"use client";

import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { useConfirm } from "@/components/ConfirmDialog";
import { BackButton } from "@/components/BackButton";
import type { ExerciseMediaData } from "@/components/ExerciseMedia";
import { RoutineExerciseEditor } from "@/features/routines/RoutineExerciseEditor";
import { AddExercisePicker } from "@/features/routines/AddExercisePicker";

interface RoutineExerciseRow {
  id: string;
  routineId: string;
  order: number;
  exerciseId: string;
  restSec: number;
  supersetGroup?: number;
  exercise?: ExerciseMediaData | null;
}

interface RoutineDetail {
  id: string;
  name: string;
  exercises: RoutineExerciseRow[];
}

interface ProgramDay {
  id: string;
  programId: string;
  routineId: string | null;
}

interface ProgramDetail {
  id: string;
  name: string;
  days: ProgramDay[];
}

export default function RoutineEditorPage() {
  // useSearchParams() needs a Suspense boundary to satisfy Next's static build.
  return (
    <Suspense fallback={null}>
      <RoutineEditor />
    </Suspense>
  );
}

function RoutineEditor() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const routineId = params.id;
  // Set when the editor was opened from a program (drives the "IN PROGRAM" row
  // and where Save/Back return to). Absent when editing straight from the
  // routine library, so there's no program context to show.
  const programId = searchParams.get("programId") || undefined;
  // Hint for where a no-program entry came from (`routines` = the standalone
  // library / Discover). Lets Back land on the library instead of the Plans hub.
  const from = searchParams.get("from") || undefined;

  // Intent-based "up" target: the originating program when opened from one, the
  // routine library when opened from there, else the Plans hub. We `replace`
  // (not push) when leaving so the editor pops off history instead of stacking
  // a fresh entry — that's what keeps the next Back deterministic (the bug was
  // pushing here, then a parent `router.back()` popping to this leftover entry).
  const backHref = programId
    ? `/programs/${programId}`
    : from === "routines"
      ? "/routines"
      : "/programs";

  const { data: routine } = useQuery({
    queryKey: qk.routine(routineId),
    queryFn: () => api<RoutineDetail>(`/api/routines/${routineId}`),
  });
  const name = routine?.name ?? "";
  const exercises = routine?.exercises ?? [];

  const { data: program } = useQuery({
    queryKey: qk.program(programId ?? ""),
    queryFn: () => api<ProgramDetail>(`/api/programs/${programId}`),
    enabled: Boolean(programId),
  });
  const programName = programId ? program?.name : undefined;

  // Owner-wide program days so we can warn before a delete that this routine is
  // wired into one or more programs. Mirrors the shared-routine detection in the
  // program editor. No single endpoint returns days-by-routine, so fan out over
  // the owner's programs and collect days that point at this routine.
  const { data: referencingDays = [] } = useQuery({
    queryKey: [...qk.routine(routineId), "referencing-days"] as const,
    queryFn: async () => {
      const programs = await api<{ id: string }[]>("/api/programs");
      const details = await Promise.all(
        programs.map((p) => api<ProgramDetail>(`/api/programs/${p.id}`)),
      );
      return details
        .flatMap((p) => p.days)
        .filter((d) => d.routineId === routineId);
    },
  });

  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  // --- drag-and-drop reorder (pointer events: works on touch + mouse) ---
  const listRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // local id ordering; mirrors the query unless a drag is in progress
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const orderRef = useRef<string[]>([]);
  useEffect(() => {
    if (!dragId) setOrderIds(exercises.map((e) => e.id));
  }, [exercises, dragId]);
  orderRef.current = orderIds;

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const ordered = dragId
    ? (orderIds.map((id) => byId.get(id)).filter(Boolean) as RoutineExerciseRow[])
    : exercises;

  function onDragMove(clientY: number) {
    const id = dragId;
    const container = listRef.current;
    if (!id || !container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-rex]"));
    let target = nodes.findIndex((n) => {
      const r = n.getBoundingClientRect();
      return clientY < r.top + r.height / 2;
    });
    if (target === -1) target = nodes.length - 1;
    setOrderIds((prev) => {
      const from = prev.indexOf(id);
      if (from === -1 || from === target) return prev;
      const next = prev.slice();
      next.splice(from, 1);
      next.splice(target, 0, id);
      return next;
    });
  }

  useEffect(() => {
    if (!dragId) return;
    const onMovePtr = (e: globalThis.PointerEvent) => {
      e.preventDefault();
      onDragMove(e.clientY);
    };
    const onUp = () => {
      const ids = orderRef.current;
      setDragId(null);
      void api(`/api/routines/${routineId}/exercises/reorder`, {
        method: "PUT",
        body: JSON.stringify({ orderedIds: ids }),
      }).then(() => queryClient.invalidateQueries({ queryKey: qk.routine(routineId) }));
    };
    window.addEventListener("pointermove", onMovePtr, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  function startDrag(id: string, e: PointerEvent) {
    e.preventDefault();
    setDragId(id);
  }

  async function onPick(exerciseId: string) {
    // pre-fill from the user's profile defaults (sets/reps/rest)
    await api(`/api/routines/${routineId}/exercises`, {
      method: "POST",
      body: JSON.stringify({ exerciseId, order: exercises.length + 1 }),
    });
    queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
  }

  // two exercises are supersetted when they share a non-null group
  function linkedNext(i: number): boolean {
    const a = exercises[i];
    const b = exercises[i + 1];
    return !!a && !!b && a.supersetGroup != null && a.supersetGroup === b.supersetGroup;
  }
  function inGroup(i: number): boolean {
    return linkedNext(i) || (i > 0 && linkedNext(i - 1));
  }

  async function setSuperset(id: string, supersetGroup: number | null) {
    await api(`/api/routine-exercises/${id}`, {
      method: "PUT",
      body: JSON.stringify({ supersetGroup }),
    });
  }

  async function toggleSupersetNext(i: number) {
    const a = exercises[i];
    const b = exercises[i + 1];
    if (!a || !b) return;
    if (linkedNext(i)) {
      // unlink b; clear a too if it isn't part of the previous pair
      await setSuperset(b.id, null);
      const prev = exercises[i - 1];
      if (!(prev && prev.supersetGroup === a.supersetGroup)) {
        await setSuperset(a.id, null);
      }
    } else {
      const group = a.supersetGroup ?? a.order;
      if (a.supersetGroup == null) await setSuperset(a.id, group);
      await setSuperset(b.id, group);
    }
    queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
  }

  // Edits persist live as you type, so Save is "I'm done": return to where you
  // came from (see `backHref`).
  function save() {
    router.replace(backHref);
  }

  async function rename() {
    if (!draftName.trim()) return;
    await api(`/api/routines/${routineId}`, {
      method: "PUT",
      body: JSON.stringify({ name: draftName.trim() }),
    });
    queryClient.invalidateQueries({ queryKey: qk.routines });
    queryClient.invalidateQueries({ queryKey: qk.routine(routineId) });
  }

  async function duplicate() {
    const { id: newId } = await api<{ id: string }>(
      `/api/routines/${routineId}/duplicate`,
      { method: "POST" },
    );
    queryClient.invalidateQueries({ queryKey: qk.routines });
    if (newId) router.push(`/routines/${newId}`);
  }

  async function remove() {
    const dayCount = referencingDays.length;
    const programCount = new Set(referencingDays.map((d) => d.programId)).size;
    const message =
      dayCount > 0
        ? `This routine is used by ${dayCount} program day${dayCount === 1 ? "" : "s"}` +
          ` across ${programCount} program${programCount === 1 ? "" : "s"}.` +
          ` Deleting it will remove it from ${dayCount === 1 ? "that day" : "those days"}.` +
          " Its exercises and sets are deleted too."
        : "This deletes the routine along with its exercises and sets. You can't undo this.";
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    await api(`/api/routines/${routineId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: qk.routines });
    router.replace(backHref);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton href={backHref} />
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={rename}
          aria-label="Routine name"
          className="flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        <button
          type="button"
          onClick={save}
          className="bg-transparent border-none px-1 text-base font-bold text-[var(--accent)]"
        >
          Save
        </button>
      </header>

      {programName && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            In program
          </span>
          <span className="rk-squircle-corners min-w-0 truncate rounded-[var(--radius-sm)] bg-[var(--accent-wash)] px-2 py-0.5 text-xs font-bold text-[var(--accent)]">
            {programName}
          </span>
        </div>
      )}

      <main className="flex-1 p-4">
        <div ref={listRef}>
          {ordered.map((re, i) => (
            <Fragment key={re.id}>
              <RoutineExerciseEditor
                routineExercise={re}
                inGroup={inGroup(i)}
                linkedNext={linkedNext(i)}
                onToggleNext={() => toggleSupersetNext(i)}
                dragging={dragId === re.id}
                onDragHandleDown={(e) => startDrag(re.id, e)}
              />
              {linkedNext(i) && (
                <div aria-hidden="true" className="flex justify-center mb-1">
                  <span className="w-[3px] h-5 rounded-full bg-[var(--accent)]" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <AddExercisePicker onPick={onPick} />

        <section className="mt-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
            Routine
          </div>
          <button
            type="button"
            onClick={duplicate}
            className="rk-squircle-corners min-h-11 w-full rounded-[var(--radius-md)] bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] font-bold py-3.5"
          >
            Duplicate routine
          </button>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Makes an independent copy. Edits to a duplicate don&apos;t touch the original or other
            programs.
          </p>

          <button
            type="button"
            onClick={remove}
            className="mt-4 w-full bg-transparent border-none py-2 text-center text-sm font-semibold text-[var(--danger)]"
          >
            Delete routine
          </button>
        </section>
      </main>

      {confirmDialog}
    </div>
  );
}
