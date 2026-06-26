import { sessionVolume } from "@rackd/core";
import type { ShareCardData } from "@rackd/ui";

export interface ShareSetRow {
  id: string;
  sessionExerciseId: string;
  weight: number;
  reps: number;
  completed: boolean;
}
export interface ShareSERow {
  id: string;
  exerciseId: string;
  exercise?: { name?: string } | null;
  sets: ShareSetRow[];
}
export interface ShareSessionTree {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  exercises: ShareSERow[];
}
export interface SharePrRow {
  id: string;
  exerciseId: string;
  type: string;
  value: number;
  sessionId: string;
}

/** Format a workout duration as "52 min" / "1 h 04 min". */
export function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}

/** Short weekday + date, e.g. "Sat, Jun 21". */
export function fmtShareDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Build the shareable-card payload (and a plain-text summary) from a finished
 * session and its PRs. Pure — units are applied via the injected `display`
 * formatter so the same logic serves the summary page and the share sheet.
 */
export function buildShareCardData(
  session: ShareSessionTree | undefined,
  prs: SharePrRow[],
  opts: { display: (kg: number) => number; unit: string },
): { cardData: ShareCardData; shareText: string } {
  const { display, unit } = opts;
  const ses = session?.exercises ?? [];
  const nameByExercise = Object.fromEntries(
    ses.map((s) => [s.exerciseId, s.exercise?.name ?? "Exercise"]),
  );
  const exerciseBySe = Object.fromEntries(ses.map((s) => [s.id, s.exerciseId]));
  const completed = ses.flatMap((s) => s.sets ?? []).filter((s) => s.completed);

  const volumeKg = sessionVolume(completed as never);
  const durMs = session?.endedAt && session?.startedAt ? session.endedAt - session.startedAt : 0;

  let topSet: string | undefined;
  if (completed.length > 0) {
    const top = completed.reduce((b, s) => (s.weight > b.weight ? s : b));
    const name = nameByExercise[exerciseBySe[top.sessionExerciseId] ?? ""] ?? "Exercise";
    topSet = `${name} · ${Math.round(display(top.weight))}${unit} × ${top.reps}`;
  }

  const cardData: ShareCardData = {
    name: session?.name ?? "Workout",
    date: session ? fmtShareDate(session.startedAt) : "",
    volume: Math.round(display(volumeKg)).toLocaleString(),
    volumeUnit: unit,
    duration: fmtDuration(durMs).replace(/ min$/, "m").replace(/ h /, "h "),
    sets: completed.length,
    prCount: prs.length,
    topSet,
  };

  const shareText = `${cardData.name} — ${cardData.volume} ${unit} volume · ${cardData.sets} sets · ${cardData.duration}${
    prs.length ? ` · ${prs.length} PR${prs.length === 1 ? "" : "s"} 💪` : ""
  } — tracked with Rackd`;

  return { cardData, shareText };
}
