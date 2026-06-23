"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  finishSession,
  addSessionExercise,
  addSet,
  setSessionExerciseOrder,
  reorderSessionExercises,
  type DetectedPR,
} from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { useQuery } from "@/lib/use-query";
import type { ExerciseMediaData } from "@/components/ExerciseMedia";
import { ExerciseCard } from "@/features/active-workout/ExerciseCard";
import { RestTimerBar } from "@/features/active-workout/RestTimerBar";
import { PrCelebration } from "@/features/active-workout/PrCelebration";
import { AddExercisePicker } from "@/features/routines/AddExercisePicker";

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  restSec: number;
  supersetGroup?: number;
  exercise?: ExerciseMediaData | null;
}

export default function WorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const { results: sessionExercises, fetching } = useQuery<SessionExerciseRow>(
    (c) =>
      c
        .query("sessionExercises")
        .Where("sessionId", "=", sessionId)
        .Include("exercise")
        .Order("order", "ASC"),
    [sessionId],
  );

  const [prs, setPrs] = useState<DetectedPR[] | null>(null);

  // --- drag-and-drop reorder (pointer events: works on touch + mouse) ---
  const listRef = useRef<HTMLDivElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  // local id ordering; mirrors the query unless a drag is in progress
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const orderRef = useRef<string[]>([]);
  useEffect(() => {
    if (!dragId) setOrderIds(sessionExercises.map((e) => e.id));
  }, [sessionExercises, dragId]);
  orderRef.current = orderIds;

  const byId = new Map(sessionExercises.map((e) => [e.id, e]));
  const ordered = dragId
    ? (orderIds.map((id) => byId.get(id)).filter(Boolean) as SessionExerciseRow[])
    : sessionExercises;

  function onDragMove(clientY: number) {
    const id = dragId;
    const container = listRef.current;
    if (!id || !container) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-sex]"));
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
      void reorderSessionExercises(getClient(), ids);
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

  async function finish() {
    const found = await finishSession(getClient(), sessionId, Date.now());
    if (found && found.length > 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([120, 60, 120]);
      setPrs(found);
    } else {
      router.push(`/workout/${sessionId}/summary`);
    }
  }

  async function onAddExercise(exerciseId: string) {
    const client = getClient();
    const se = await addSessionExercise(client, {
      sessionId,
      exerciseId,
      order: sessionExercises.length + 1,
    });
    await addSet(client, { sessionExerciseId: se.id, order: 1 });
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sessionExercises.length) return;
    const a = sessionExercises[index];
    const b = sessionExercises[j];
    if (!a || !b) return;
    const client = getClient();
    await Promise.all([
      setSessionExerciseOrder(client, a.id, b.order),
      setSessionExerciseOrder(client, b.id, a.order),
    ]);
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back"
          className="bg-transparent border-none text-lg text-[var(--text-muted)]"
        >
          ←
        </button>
        <h1 className="text-lg font-bold">Active Workout</h1>
        <button
          type="button"
          onClick={finish}
          className="ms-auto inline-flex items-center min-h-10 px-4 rounded-lg bg-[var(--success)] text-[#06231a] font-bold"
        >
          Finish
        </button>
      </header>

      <main className="flex-1 p-4">
        {fetching && <p className="text-[var(--text-muted)]">Loading…</p>}
        {!fetching && sessionExercises.length === 0 && (
          <p className="text-[var(--text-muted)]">No exercises in this session.</p>
        )}
        <div ref={listRef}>
          {ordered.map((se, i) => {
            const prev = ordered[i - 1];
            const next = ordered[i + 1];
            const g = se.supersetGroup;
            const inGroup = g != null && (prev?.supersetGroup === g || next?.supersetGroup === g);
            // skip rest when the next exercise is your superset partner (go straight to it)
            const startsRest = g == null || next?.supersetGroup !== g;
            return (
              <Fragment key={se.id}>
                <ExerciseCard
                  sessionExercise={se}
                  index={i}
                  total={ordered.length}
                  onMove={(dir) => move(i, dir)}
                  inGroup={inGroup}
                  startsRest={startsRest}
                  dragging={dragId === se.id}
                  onDragHandleDown={(e) => startDrag(se.id, e)}
                />
                {!startsRest && (
                  <div aria-hidden="true" className="flex justify-center mb-1">
                    <span className="w-[3px] h-5 rounded-full bg-[var(--accent)]" />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        {!fetching && <AddExercisePicker onPick={onAddExercise} />}
      </main>

      <RestTimerBar />

      {prs && (
        <PrCelebration
          prs={prs}
          nameById={Object.fromEntries(
            sessionExercises.map((se) => [se.exerciseId, se.exercise?.name ?? "Exercise"]),
          )}
          onClose={() => router.push(`/workout/${sessionId}/summary`)}
        />
      )}
    </div>
  );
}
