"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { diffSessionVsRoutine, type SessionDiff } from "@rackd/core";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import type { ExerciseMediaData } from "@/components/ExerciseMedia";
import { useConfirm } from "@/components/ConfirmDialog";
import { BackButton } from "@/components/BackButton";
import { ExerciseCard } from "@/features/active-workout/ExerciseCard";
import { RestTimerBar } from "@/features/active-workout/RestTimerBar";
import { useTimerStore } from "@/features/active-workout/timer-store";
import { PrCelebration } from "@/features/active-workout/PrCelebration";
import { FinishPromptSheet } from "@/features/active-workout/FinishPromptSheet";
import {
  SaveBackSheet,
  type SaveBackMode,
  type SaveBackTarget,
} from "@/features/active-workout/SaveBackSheet";
import { AddExercisePicker } from "@/features/routines/AddExercisePicker";
import type { SetRowData } from "@/features/active-workout/SetRow";

interface DetectedPR {
  exerciseId: string;
  type: "1rm" | "weight";
  value: number;
}

/** What `GET /api/sessions/[id]/save-back-context` returns (was `@rackd/db`). */
interface DiffExercise {
  exerciseId: string;
  sets: { weight: number; reps: number }[];
}
interface SaveBackContext {
  routineId: string;
  routineName: string;
  prescription: DiffExercise[];
  performed: DiffExercise[];
  program: { programDayId: string; programName: string } | null;
}

interface SaveBackState {
  diff: SessionDiff;
  routineId: string;
  routineName: string;
  programName: string | null;
  programDayId: string | null;
}

interface SessionExerciseRow {
  id: string;
  sessionId: string;
  exerciseId: string;
  order: number;
  restSec: number;
  supersetGroup?: number;
  exercise?: ExerciseMediaData | null;
  sets?: SetRowData[];
}

/** The session tree returned by `GET /api/sessions/[id]`. */
interface SessionTree {
  id: string;
  exercises: SessionExerciseRow[];
}

/**
 * The exercise the lifter is "on" right now: the first (in order) still holding
 * an incomplete set, or the last one if everything's done. Drives auto-scroll
 * (#18) — we snap back here after a rest, on reopen, and once on load.
 */
function computeCurrentId(exs: SessionExerciseRow[]): string | null {
  const ordered = [...exs].sort((a, b) => a.order - b.order);
  for (const se of ordered) {
    const sets = se.sets ?? [];
    if (sets.length === 0 || sets.some((s) => !s.completed)) return se.id;
  }
  return ordered[ordered.length - 1]?.id ?? null;
}

export default function WorkoutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sessionId = params.id;

  const { data: session, isLoading: fetching } = useQuery({
    queryKey: qk.session(sessionId),
    queryFn: () => api<SessionTree>(`/api/sessions/${sessionId}`),
  });
  const sessionExercises = session?.exercises ?? [];

  const [prs, setPrs] = useState<DetectedPR[] | null>(null);
  const [saveBack, setSaveBack] = useState<SaveBackState | null>(null);
  const [showFinishPrompt, setShowFinishPrompt] = useState(false);

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
    ? (orderIds
        .map((id) => byId.get(id))
        .filter(Boolean) as SessionExerciseRow[])
    : sessionExercises;

  function onDragMove(clientY: number) {
    const id = dragId;
    const container = listRef.current;
    if (!id || !container) return;
    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>("[data-sex]"),
    );
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
      void api(`/api/sessions/${sessionId}/exercises/reorder`, {
        method: "PUT",
        body: JSON.stringify({ orderedIds: ids }),
      }).then(() =>
        queryClient.invalidateQueries({ queryKey: qk.session(sessionId) }),
      );
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

  // --- auto-scroll to the current exercise (#18) ---
  // Live id of the current exercise, recomputed each render (cheap) and read
  // through a ref so the listeners below always see the latest without
  // re-subscribing. We only scroll on explicit moments — never on the per-set
  // query refetch — so the lifter's own scrolling is never yanked.
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = computeCurrentId(sessionExercises);

  function scrollToCurrent(behavior: ScrollBehavior) {
    const id = currentIdRef.current;
    if (!id) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-sex="${id}"]`,
    );
    if (el)
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior, block: "start" }),
      );
  }

  // 1) Once, after the session first loads, jump to where you left off.
  const didInitialScroll = useRef(false);
  useEffect(() => {
    if (didInitialScroll.current || sessionExercises.length === 0) return;
    didInitialScroll.current = true;
    scrollToCurrent("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionExercises.length]);

  // 2) When a rest ends (timer leaves running → idle), bring the current
  //    exercise back so the next set is right there.
  const timerStatus = useTimerStore((s) => s.state.status);
  const wasResting = useRef(false);
  useEffect(() => {
    if (timerStatus !== "idle") {
      wasResting.current = true;
      return;
    }
    if (wasResting.current) {
      wasResting.current = false;
      scrollToCurrent("smooth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStatus]);

  // 3) Reopening the app (foreground / tab focus) re-centers the current one.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "visible") scrollToCurrent("auto");
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- offer to finish once every set is logged ---
  // True when there's at least one exercise and every set across all of them is
  // completed.
  const allLogged =
    sessionExercises.length > 0 &&
    sessionExercises.every((se) => {
      const sets = se.sets ?? [];
      return sets.length > 0 && sets.every((s) => s.completed);
    });

  // Prompt only on a real false → true transition (completing the final set) —
  // never on the initial load of an already-complete session, and never again
  // while it stays complete (so "Add more" isn't re-nagged). Adding/uncompleting
  // a set flips it back to false and re-arms the prompt.
  const prevAllLogged = useRef<boolean | null>(null);
  useEffect(() => {
    if (fetching || sessionExercises.length === 0) return;
    const prev = prevAllLogged.current;
    prevAllLogged.current = allLogged;
    if (allLogged && prev === false) {
      // Workout's done — kill the rest timer the final set just started.
      useTimerStore.getState().skip();
      setShowFinishPrompt(true);
    } else if (!allLogged) {
      setShowFinishPrompt(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allLogged, fetching]);

  function goSummary() {
    router.push(`/workout/${sessionId}/summary`);
  }

  /**
   * After finishing (and any PR celebration): if the session came from a routine
   * and diverged from its prescription, offer save-back before the summary.
   */
  async function afterFinish() {
    const ctx = await api<SaveBackContext | null>(
      `/api/sessions/${sessionId}/save-back-context`,
    );
    if (!ctx) return goSummary();
    const diff = diffSessionVsRoutine(ctx.prescription, ctx.performed);
    if (!diff.exercisesChanged && !diff.numbersChanged) return goSummary();
    setSaveBack({
      diff,
      routineId: ctx.routineId,
      routineName: ctx.routineName,
      programName: ctx.program?.programName ?? null,
      programDayId: ctx.program?.programDayId ?? null,
    });
  }

  /**
   * Abandon the workout: confirm (destructive + irreversible), cascade-delete
   * the session, then go home. With the session gone, the global MiniWorkoutBar
   * (driven by any session with endedAt == null) disappears.
   */
  async function discard() {
    const ok = await confirm({
      title: "Discard this workout?",
      message: "Everything logged in it will be permanently deleted.",
      confirmLabel: "Discard",
    });
    if (!ok) return;
    await api(`/api/sessions/${sessionId}/discard`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: qk.activeSession });
    queryClient.invalidateQueries({ queryKey: qk.sessions });
    router.push("/");
  }

  async function finish() {
    const { prs: found } = await api<{ prs: DetectedPR[] }>(
      `/api/sessions/${sessionId}/finish`,
      { method: "POST" },
    );
    queryClient.invalidateQueries({ queryKey: qk.sessions });
    queryClient.invalidateQueries({ queryKey: qk.activeSession });
    queryClient.invalidateQueries({ queryKey: qk.personalRecords });
    if (found && found.length > 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator)
        navigator.vibrate([120, 60, 120]);
      setPrs(found);
    } else {
      await afterFinish();
    }
  }

  /** Save-back: "here" forks the routine into a copy this program points at; "everywhere" edits the shared routine. */
  async function onSaveBack(mode: SaveBackMode, target: SaveBackTarget) {
    const sb = saveBack;
    if (!sb) return;
    if (target === "here" && sb.programDayId) {
      // Fork keeps the original name (no "(copy)") — it's this program's private
      // copy of the routine, not a user-visible duplicate.
      const { id: copyId } = await api<{ id: string }>(
        `/api/routines/${sb.routineId}/duplicate`,
        { method: "POST", body: JSON.stringify({ name: sb.routineName }) },
      );
      if (copyId) {
        await api(`/api/program-days/${sb.programDayId}`, {
          method: "PUT",
          body: JSON.stringify({ routineId: copyId }),
        });
        await api(`/api/sessions/${sessionId}/save-back`, {
          method: "POST",
          body: JSON.stringify({ routineId: copyId, mode }),
        });
      }
    } else {
      await api(`/api/sessions/${sessionId}/save-back`, {
        method: "POST",
        body: JSON.stringify({ routineId: sb.routineId, mode }),
      });
    }
    queryClient.invalidateQueries({ queryKey: qk.routines });
    setSaveBack(null);
    goSummary();
  }

  async function onAddExercise(exerciseId: string) {
    const se = await api<{ id: string }>(
      `/api/sessions/${sessionId}/exercises`,
      {
        method: "POST",
        body: JSON.stringify({
          exerciseId,
          order: sessionExercises.length + 1,
        }),
      },
    );
    await api("/api/set-logs", {
      method: "POST",
      body: JSON.stringify({ sessionExerciseId: se.id, order: 1 }),
    });
    queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= sessionExercises.length) return;
    const a = sessionExercises[index];
    const b = sessionExercises[j];
    if (!a || !b) return;
    await Promise.all([
      api(`/api/session-exercises/${a.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: b.order }),
      }),
      api(`/api/session-exercises/${b.id}`, {
        method: "PUT",
        body: JSON.stringify({ order: a.order }),
      }),
    ]);
    queryClient.invalidateQueries({ queryKey: qk.session(sessionId) });
  }

  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-3 py-3 px-4 bg-[var(--bg)] border-b border-[var(--border)]">
        <BackButton onClick={() => router.push("/")} />
        <h1 className="text-lg font-bold">Active Workout</h1>
        <button
          type="button"
          onClick={discard}
          className="ms-auto inline-flex items-center min-h-10 px-3 rounded-lg border border-[var(--danger)] bg-transparent text-[var(--danger)] font-semibold"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={finish}
          className="inline-flex items-center min-h-10 px-4 rounded-lg bg-[var(--success)] text-[#06231a] font-bold"
        >
          Finish
        </button>
      </header>

      <main className="flex-1 p-4">
        {fetching && <p className="text-[var(--text-muted)]">Loading…</p>}
        {!fetching && sessionExercises.length === 0 && (
          <p className="text-[var(--text-muted)]">
            No exercises in this session.
          </p>
        )}
        <div ref={listRef}>
          {ordered.map((se, i) => {
            const prev = ordered[i - 1];
            const next = ordered[i + 1];
            const g = se.supersetGroup;
            const inGroup =
              g != null &&
              (prev?.supersetGroup === g || next?.supersetGroup === g);
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

      <FinishPromptSheet
        open={showFinishPrompt}
        onFinish={() => {
          setShowFinishPrompt(false);
          void finish();
        }}
        onKeepGoing={() => setShowFinishPrompt(false)}
      />

      {prs && (
        <PrCelebration
          prs={prs}
          nameById={Object.fromEntries(
            sessionExercises.map((se) => [
              se.exerciseId,
              se.exercise?.name ?? "Exercise",
            ]),
          )}
          onClose={() => {
            setPrs(null);
            void afterFinish();
          }}
        />
      )}

      {saveBack && (
        <SaveBackSheet
          diff={saveBack.diff}
          routineName={saveBack.routineName}
          programName={saveBack.programName}
          onSkip={goSummary}
          onSave={onSaveBack}
        />
      )}

      {confirmDialog}
    </div>
  );
}
