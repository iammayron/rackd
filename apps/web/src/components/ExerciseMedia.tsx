"use client";

import { useState } from "react";

export interface ExerciseMediaData {
  name: string;
  primaryMuscle: string;
  secondaryMuscles?: string[] | Set<string>;
  equipment?: string;
  instructions?: string;
  thumbnailUrl?: string;
  clipUrl?: string;
  clipUrlWebm?: string;
}

const MUSCLE_COLOR: Record<string, string> = {
  chest: "#e2483d",
  back: "#3a63da",
  shoulders: "#f5b301",
  biceps: "#9b5de5",
  triceps: "#8b5cf6",
  forearms: "#6b7280",
  quads: "#36d399",
  hamstrings: "#14b8a6",
  glutes: "#ec4899",
  calves: "#0ea5e9",
  abs: "#f97316",
  traps: "#64748b",
  fullbody: "#4f7cff",
};

function colorFor(muscle: string): string {
  return MUSCLE_COLOR[muscle] ?? "var(--surface-2)";
}

/** Square thumbnail: real image if present, else a muscle-colored initial (offline-safe). */
export function ExerciseThumb({
  ex,
  size = 44,
  onClick,
}: {
  ex: ExerciseMediaData;
  size?: number;
  onClick?: () => void;
}) {
  const initial = ex.name.charAt(0).toUpperCase();
  const style: React.CSSProperties = { width: size, height: size, minWidth: size };
  const inner = ex.thumbnailUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ex.thumbnailUrl} alt={ex.name} className="w-full h-full object-cover" />
  ) : (
    <div
      className="w-full h-full flex items-center justify-center font-bold text-white"
      style={{ background: colorFor(ex.primaryMuscle) }}
    >
      {initial}
    </div>
  );
  if (!onClick) return <div className="rk-squircle" style={style}>{inner}</div>;
  return (
    <button type="button" onClick={onClick} aria-label={`${ex.name} details`} className="rk-squircle" style={style}>
      {inner}
    </button>
  );
}

function muscleList(m?: string[] | Set<string>): string[] {
  if (!m) return [];
  return Array.isArray(m) ? m : [...m];
}

/** Detail modal: looping clip when clipUrl is set, else big fallback + instructions. */
export function ExerciseMediaModal({ ex, onClose }: { ex: ExerciseMediaData; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center mb-3">
          <h2 className="flex-1 text-lg font-bold">{ex.name}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg text-[var(--text-muted)]">
            ×
          </button>
        </div>

        <div className="rounded-[var(--radius)] overflow-hidden mb-3 aspect-video bg-[var(--surface-2)] flex items-center justify-center">
          {ex.clipUrl ? (
            <video
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              poster={ex.thumbnailUrl}
            >
              {ex.clipUrlWebm && <source src={ex.clipUrlWebm} type="video/webm" />}
              <source src={ex.clipUrl} type="video/mp4" />
            </video>
          ) : (
            <div
              className="w-20 h-20 rounded-[var(--radius)] flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: colorFor(ex.primaryMuscle) }}
            >
              {ex.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {[ex.primaryMuscle, ...muscleList(ex.secondaryMuscles), ex.equipment]
            .filter(Boolean)
            .map((tag, i) => (
              <span
                key={i}
                className="text-xs rounded-full px-2 py-1 bg-[var(--surface-2)] text-[var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
        </div>

        {ex.instructions && <p className="text-sm text-[var(--text)]">{ex.instructions}</p>}
      </div>
    </div>
  );
}
