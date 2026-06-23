"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  renameRoutine,
  addRoutineExerciseWithDefaults,
  startSessionFromRoutine,
  setRoutineExerciseOrder,
  setRoutineExerciseSuperset,
  reorderRoutineExercises,
  publishRoutine,
  setRoutineSchedule,
} from "@myfit/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId, useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { RoutineExerciseEditor } from "@/features/routines/RoutineExerciseEditor";
import { AddExercisePicker } from "@/features/routines/AddExercisePicker";
import { WeekdayPicker } from "@/features/routines/WeekdayPicker";

interface RoutineExerciseRow {
  id: string;
  order: number;
  supersetGroup?: number;
  exercise?: { name: string } | null;
}

export default function RoutineEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const routineId = params.id;

  const { results: routine } = useQuery<{
    id: string;
    name: string;
    scheduledDays?: Set<number> | number[];
  }>((c) => c.query("routines").Where("id", "=", routineId), [routineId]);
  const name = routine[0]?.name ?? "";
  const scheduledDays = [...(routine[0]?.scheduledDays ?? [])];

  const { results: exercises } = useQuery<RoutineExerciseRow>(
    (c) =>
      c
        .query("routineExercises")
        .Where("routineId", "=", routineId)
        .Include("exercise")
        .Order("order", "ASC"),
    [routineId],
  );

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
      void reorderRoutineExercises(getClient(), ids);
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

  const { user } = useAuth();
  const [published, setPublished] = useState(false);
  async function publish() {
    if (exercises.length === 0) return;
    await publishRoutine(getClient(), {
      routineId,
      ownerId: getCurrentUserId(),
      authorName: user?.email?.split("@")[0] ?? "Someone",
      now: Date.now(),
    });
    setPublished(true);
    setTimeout(() => setPublished(false), 2500);
  }

  async function onPick(exerciseId: string) {
    // pre-fill from the user's profile defaults (sets/reps/rest)
    await addRoutineExerciseWithDefaults(getClient(), {
      routineId,
      exerciseId,
      order: exercises.length + 1,
      ownerId: getCurrentUserId(),
    });
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= exercises.length) return;
    const a = exercises[index];
    const b = exercises[j];
    if (!a || !b) return;
    const client = getClient();
    await Promise.all([
      setRoutineExerciseOrder(client, a.id, b.order),
      setRoutineExerciseOrder(client, b.id, a.order),
    ]);
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

  async function toggleSupersetNext(i: number) {
    const a = exercises[i];
    const b = exercises[i + 1];
    if (!a || !b) return;
    const client = getClient();
    if (linkedNext(i)) {
      // unlink b; clear a too if it isn't part of the previous pair
      await setRoutineExerciseSuperset(client, b.id, undefined);
      const prev = exercises[i - 1];
      if (!(prev && prev.supersetGroup === a.supersetGroup)) {
        await setRoutineExerciseSuperset(client, a.id, undefined);
      }
    } else {
      const group = a.supersetGroup ?? a.order;
      if (a.supersetGroup == null) await setRoutineExerciseSuperset(client, a.id, group);
      await setRoutineExerciseSuperset(client, b.id, group);
    }
  }

  async function start() {
    const s = await startSessionFromRoutine(getClient(), {
      routineId,
      ownerId: getCurrentUserId(),
      now: Date.now(),
    });
    router.push(`/workout/${s.id}`);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/routines")}
          aria-label="Back"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ←
        </button>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => draftName.trim() && renameRoutine(getClient(), routineId, draftName.trim())}
          aria-label="Routine name"
          className="flex-1 bg-transparent border-none text-lg font-bold text-[var(--text)] focus:outline-none"
        />
        <button
          type="button"
          onClick={start}
          disabled={exercises.length === 0}
          className={`inline-flex items-center min-h-10 px-4 rounded-lg font-bold ${
            exercises.length
              ? "bg-[var(--accent)] text-white"
              : "bg-[var(--surface-2)] text-[var(--text-muted)]"
          }`}
        >
          Start
        </button>
      </header>

      <main className="flex-1 p-4">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[var(--text-muted)] mb-2">
            Scheduled days
          </p>
          <WeekdayPicker
            value={scheduledDays}
            onChange={(days) => setRoutineSchedule(getClient(), routineId, days)}
          />
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Picked days surface this routine as “Today’s workout” on the dashboard.
          </p>
        </div>

        <div ref={listRef}>
          {ordered.map((re, i) => (
            <RoutineExerciseEditor
              key={re.id}
              routineExercise={re}
              index={i}
              total={ordered.length}
              onMove={(dir) => move(i, dir)}
              inGroup={inGroup(i)}
              linkedNext={linkedNext(i)}
              onToggleNext={() => toggleSupersetNext(i)}
              dragging={dragId === re.id}
              onDragHandleDown={(e) => startDrag(re.id, e)}
            />
          ))}
        </div>
        <AddExercisePicker onPick={onPick} />

        {exercises.length > 0 && (
          <button
            type="button"
            onClick={publish}
            className="mt-3 min-h-11 w-full rounded-lg bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] font-semibold"
          >
            {published ? "Published to Discover ✓" : "Publish to Discover"}
          </button>
        )}
      </main>
    </div>
  );
}
