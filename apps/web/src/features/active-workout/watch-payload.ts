import { formatWeight, type Unit } from "@rackd/core";

/**
 * Snapshot the phone publishes to a paired Wear OS watch.
 * The Java bridge in `android/app/.../WearBridge.java` mirrors `mergeWatchPublish`,
 * `afterLog`, `afterAdjust`, `afterSkip`, and `afterAdd`. Keep the two in step.
 */

export interface WatchExerciseInput {
  name: string;
  restSec: number;
  /** Same number on consecutive exercises means one superset. */
  supersetGroup?: number | null;
  sets: { id: string; order: number; weight: number; reps: number; completed: boolean }[];
}

export interface WatchItem {
  setId: string;
  name: string;
  index: number;
  count: number;
  /** Canonical kilograms. The watch steps this and the phone stores it. */
  weight: number;
  weightLabel: string;
  reps: number;
  restSec: number;
  /** False for every superset member except the last. Those sets do not start a rest. */
  rests: boolean;
  completed: boolean;
}

export interface WatchPublish {
  sessionId: string;
  ack: number;
  restEndAt: number;
  unit: Unit;
  items: WatchItem[];
}

export interface StoredWatch {
  revision: number;
  sessionId: string;
  restEndAt: number;
  unit: Unit;
  items: WatchItem[];
}

export function buildWatchPayload(
  exercises: WatchExerciseInput[],
  unit: Unit,
  restEndAt: number | null,
  ack: number,
  sessionId = "",
): WatchPublish {
  const rests = restsAfter(exercises);
  const items: WatchItem[] = [];
  exercises.forEach((ex, exIndex) => {
    const sets = [...ex.sets].sort((a, b) => a.order - b.order);
    sets.forEach((set, i) => {
      items.push({
        setId: set.id,
        name: ex.name || "Exercise",
        index: i + 1,
        count: sets.length,
        weight: set.weight,
        weightLabel: formatWeight(set.weight, unit),
        reps: set.reps,
        restSec: ex.restSec,
        rests: rests[exIndex] ?? true,
        completed: set.completed,
      });
    });
  });
  return { sessionId, ack, restEndAt: restEndAt && restEndAt > 0 ? restEndAt : 0, unit, items };
}

/** Which exercises start a rest when one of their sets is logged. */
export function restsAfter(exercises: { supersetGroup?: number | null }[]): boolean[] {
  const rests = exercises.map(() => true);
  let i = 0;
  while (i < exercises.length) {
    const group = exercises[i]?.supersetGroup;
    let j = i + 1;
    if (group != null) {
      while (j < exercises.length && exercises[j]?.supersetGroup === group) j++;
    }
    if (j - i >= 2) {
      for (let k = i; k < j - 1; k++) rests[k] = false;
    }
    i = j;
  }
  return rests;
}

/**
 * Phone UI publish. While `ack` is behind `revision`, a watch tap has already
 * changed the snapshot and the UI has not refetched yet — don't roll that back.
 */
export function mergeWatchPublish(
  stored: StoredWatch | null,
  incoming: WatchPublish,
  _now: number,
): StoredWatch {
  const revision = stored?.revision ?? 0;
  if (!stored || incoming.ack >= revision) {
    return {
      revision,
      sessionId: incoming.sessionId,
      restEndAt: incoming.restEndAt,
      unit: incoming.unit,
      items: incoming.items,
    };
  }
  const previous = new Map(stored.items.map((item) => [item.setId, item]));
  return {
    revision,
    sessionId: stored.sessionId,
    restEndAt: stored.restEndAt,
    unit: stored.unit,
    items: incoming.items.map((item) => {
      const prev = previous.get(item.setId);
      if (!prev) return item;
      return {
        ...item,
        weight: prev.weight,
        weightLabel: prev.weightLabel,
        reps: prev.reps,
        completed: prev.completed || item.completed,
      };
    }),
  };
}

export function afterLog(
  stored: StoredWatch,
  now: number,
  setId?: string,
): { next: StoredWatch; setId: string | null } {
  const items = stored.items.map((item) => ({ ...item }));
  const target = setId
    ? items.find((item) => item.setId === setId && !item.completed)
    : items.find((item) => !item.completed);
  if (!target) return { next: stored, setId: null };
  target.completed = true;
  const anyLeft = items.some((item) => !item.completed);
  const restEndAt = target.rests && anyLeft && target.restSec > 0 ? now + target.restSec * 1000 : 0;
  return {
    setId: target.setId,
    next: {
      revision: stored.revision + 1,
      sessionId: stored.sessionId,
      restEndAt,
      unit: stored.unit,
      items,
    },
  };
}

/** Weight is canonical kg. Bumps revision so a stale phone publish cannot undo the edit. */
export function afterAdjust(
  stored: StoredWatch,
  setId: string,
  patch: { weight?: number; reps?: number },
): StoredWatch {
  let changed = false;
  const items = stored.items.map((item) => {
    if (item.setId !== setId) return item;
    const weight = patch.weight ?? item.weight;
    const reps = patch.reps ?? item.reps;
    if (weight === item.weight && reps === item.reps) return item;
    changed = true;
    return { ...item, weight, reps, weightLabel: formatWeight(weight, stored.unit) };
  });
  if (!changed) return stored;
  return { ...stored, revision: stored.revision + 1, items };
}

export function afterSkip(stored: StoredWatch): StoredWatch {
  return { ...stored, revision: stored.revision + 1, restEndAt: 0 };
}

export function afterAdd(stored: StoredWatch, now: number): StoredWatch {
  const base = stored.restEndAt > now ? stored.restEndAt : now;
  return { ...stored, revision: stored.revision + 1, restEndAt: base + 30_000 };
}
