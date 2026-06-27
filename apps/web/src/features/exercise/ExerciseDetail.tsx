"use client";

import { useMemo } from "react";
import { suggestReplacements } from "@rackd/core";
import {
  Card,
  Badge,
  MuscleVisualizer,
  exerciseGradient,
  type MuscleInvolvementView,
} from "@rackd/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { LineChart, BarChart } from "@/components/Chart";

interface ExerciseMediaView {
  kind: string;
  url: string;
  width?: number | null;
  height?: number | null;
  order: number;
}

interface ExerciseRow {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[];
  equipment: string;
  category: string;
  instructions?: string;
  formCues?: string[];
  thumbnailUrl?: string;
  clipUrl?: string;
  clipUrlWebm?: string;
  // Exercise-data-platform fields (present on seeded library rows).
  movementPattern?: string;
  mechanic?: string;
  /** Fine-grained muscle involvement + activation (from getExerciseDetail). */
  muscles?: MuscleInvolvementView[];
  /** Ordered media (the [id] detail route joins this). */
  media?: ExerciseMediaView[];
}

/** Per-session stat point for one exercise (mirrors the /stats route). */
interface ExerciseStatPoint {
  sessionId: string;
  date: number;
  best1rm: number;
  volume: number;
  topWeight: number;
}

const EYEBROW =
  "text-[var(--text-muted)] text-xs font-bold uppercase tracking-wider mb-3";

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/** Instructions are a single string; split into steps on newlines, else one block. */
function steps(instructions?: string): string[] {
  if (!instructions) return [];
  const lines = instructions
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return lines.length ? lines : [instructions.trim()];
}

/**
 * The exercise-detail body, shared by the slide-up sheet and the deep-link page.
 * `onSelectExercise` decides what a "Similar exercise" tap does — swap the sheet
 * (store.open) or navigate the page (router.push).
 */
export function ExerciseDetail({
  id,
  onSelectExercise,
}: {
  id: string;
  onSelectExercise: (id: string) => void;
}) {
  const { unit, display } = useUnit();

  const { data: ex } = useQuery({
    queryKey: qk.exercise(id),
    queryFn: () => api<ExerciseRow>(`/api/exercises/${id}`),
    enabled: Boolean(id),
  });
  const { data: all = [] } = useQuery({
    queryKey: qk.exercises,
    queryFn: () => api<ExerciseRow[]>("/api/exercises"),
  });
  const { data: points = [] } = useQuery({
    queryKey: qk.exerciseStats(id),
    queryFn: () => api<ExerciseStatPoint[]>(`/api/exercises/${id}/stats`),
    enabled: Boolean(id),
  });

  const similar = useMemo(() => {
    if (!ex) return [];
    return suggestReplacements(all, {
      id: ex.id,
      primaryMuscle: ex.primaryMuscle,
      equipment: ex.equipment,
      secondaryMuscles: [...(ex.secondaryMuscles ?? [])],
      movementPattern: ex.movementPattern,
      mechanic: ex.mechanic,
    }).slice(0, 5);
  }, [all, ex]);

  if (!ex) {
    return <p className="px-1 py-6 text-[var(--text-muted)]">Exercise not found.</p>;
  }

  const secondary = [...(ex.secondaryMuscles ?? [])];
  // Demonstration frames (free-exercise-db ships start/end photos per exercise).
  const frames = (ex.media ?? []).filter((m) => m.kind === "image").map((m) => m.url);
  const heroImage = frames[0] ?? ex.thumbnailUrl;
  const initials = ex.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const instructionSteps = steps(ex.instructions);
  const cues = ex.formCues ?? [];

  // Volume over the last 6 sessions, left-padded so a sparse history reads as a
  // trend (one bar + a flat baseline) instead of a single full-width block —
  // matching the Progress page's volume chart.
  const VOL_WINDOW = 6;
  const recentVolume = points.slice(-VOL_WINDOW).map((p) => display(p.volume));
  const volumeSeries = [
    ...Array(Math.max(0, VOL_WINDOW - recentVolume.length)).fill(0),
    ...recentVolume,
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Hero media — real clip/thumbnail when present, else a tinted placeholder. */}
      <div
        className="relative -mx-4 -mt-2 h-[180px] flex items-center justify-center overflow-hidden"
        style={{ background: exerciseGradient(ex.primaryMuscle) }}
      >
        {ex.clipUrl ? (
          <video
            src={ex.clipUrl}
            poster={ex.thumbnailUrl}
            muted
            loop
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="text-[64px] font-extrabold tracking-tight"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {initials}
          </span>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Badge tone="accent">{cap(ex.primaryMuscle)}</Badge>
        <Badge tone="neutral">{cap(ex.equipment)}</Badge>
      </div>

      {frames.length > 1 && (
        <Card>
          <div className={EYEBROW}>Demonstration</div>
          <div className="flex gap-2 overflow-x-auto">
            {frames.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`${ex.name} — step ${i + 1}`}
                className="h-28 w-auto flex-shrink-0 rounded-[var(--radius)] border border-[var(--border)] object-cover"
              />
            ))}
          </div>
        </Card>
      )}

      {instructionSteps.length > 0 && (
        <Card>
          <div className={EYEBROW}>How to perform</div>
          <ol className="m-0 p-0 list-none flex flex-col gap-3">
            {instructionSteps.map((step, i) => (
              <li key={i} className="flex gap-3 items-start">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-extrabold mt-px"
                  style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
                >
                  {i + 1}
                </span>
                <span className="text-[14.5px] leading-normal">{step}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {cues.length > 0 && (
        <Card>
          <div className={EYEBROW}>Form cues</div>
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
            {cues.map((cue, i) => (
              <li key={i} className="flex gap-2.5 items-start">
                <span className="mt-px text-[var(--accent)] font-extrabold" aria-hidden="true">
                  ✓
                </span>
                <span className="text-[14.5px] leading-normal">{cue}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className={EYEBROW}>Muscles worked</div>
        <MuscleVisualizer
          primary={ex.primaryMuscle}
          secondary={secondary}
          muscles={ex.muscles}
        />
      </Card>

      {similar.length > 0 && (
        <Card>
          <div className={EYEBROW}>Similar exercises</div>
          <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {similar.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelectExercise(s.id)}
                  className="flex w-full items-center gap-3 min-h-11 py-2 text-left text-[var(--text)]"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="ms-auto text-sm text-[var(--text-muted)]">
                    {cap(s.primaryMuscle)} · {cap(s.equipment)}
                  </span>
                  <span className="text-[var(--text-muted)]">›</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {points.length > 0 && (
        <>
          <Card variant="feature">
            <div className={EYEBROW}>Est 1RM over time</div>
            <LineChart data={points.map((p) => display(p.best1rm))} unit={unit} />
          </Card>
          <Card variant="feature">
            <div className={EYEBROW}>Volume · last {VOL_WINDOW} sessions</div>
            <BarChart data={volumeSeries} unit={unit} />
          </Card>
        </>
      )}
    </div>
  );
}
