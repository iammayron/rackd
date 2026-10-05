"use client";

import * as React from "react";
import { MuscleMap } from "./MuscleMap";

/**
 * Muscle → accent hue (OKLCH), driving placeholder media + the visualizer bars.
 * Keyed by the @rackd/core MuscleGroup values (lowercase); tolerant of any case.
 */
const HUE: Record<string, number> = {
  chest: 8,
  back: 212,
  shoulders: 270,
  biceps: 50,
  triceps: 32,
  forearms: 38,
  quads: 150,
  hamstrings: 175,
  glutes: 330,
  calves: 160,
  abs: 192,
  traps: 230,
  fullbody: 220,
  other: 220,
};

export function muscleHue(muscle: string): number {
  return HUE[(muscle ?? "").toLowerCase()] ?? 220;
}

/**
 * Deterministic tinted gradient keyed off a muscle's hue — the placeholder for
 * exercise media until real photos/clips ship (use the real thumbnailUrl/clipUrl
 * when present, this when not).
 */
export function exerciseGradient(muscle: string): string {
  const h = muscleHue(muscle);
  return `linear-gradient(135deg, oklch(0.62 0.13 ${h}) 0%, oklch(0.48 0.15 ${h + 18}) 100%)`;
}

function label(m: string): string {
  if (!m) return m;
  if (m.toLowerCase() === "fullbody") return "Full body";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

/** Fine-grained muscle involvement (from the exercise detail API). */
export interface MuscleInvolvementView {
  /** Display name, e.g. "Lats". */
  name: string;
  /** Coarse MuscleGroup the muscle rolls up to — drives hue + the map region. */
  canonicalGroup: string;
  role: string;
  /** 0..1 — drives bar width. */
  activation: number;
}

export interface MuscleVisualizerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Primary mover (rendered at full intensity). */
  primary: string;
  /** Assisting groups (rendered at reduced intensity). */
  secondary?: string[];
  /**
   * Fine-grained involvement (optional). When present, the bars show the real
   * muscle names + activation weights; the map still highlights by coarse group.
   * Falls back to primary/secondary when absent.
   */
  muscles?: MuscleInvolvementView[];
  /** Show the anatomical map beside the bars. */
  showBody?: boolean;
}

interface Bar {
  key: string;
  label: string;
  level: number;
  role: string;
  hue: number;
}

/**
 * Muscles-worked visualizer: a self-owned anatomical MuscleMap (front + back,
 * worked regions highlighted) beside per-muscle intensity bars. With fine
 * `muscles` data the bars show real muscle names + activation; otherwise they
 * fall back to the coarse primary/secondary groups.
 */
export function MuscleVisualizer({
  primary,
  secondary = [],
  muscles,
  showBody = true,
  style,
  ...rest
}: MuscleVisualizerProps) {
  const fine = muscles && muscles.length > 0 ? muscles : null;

  const bars: Bar[] = fine
    ? fine.map((m, i) => ({
        key: `${m.name}-${i}`,
        label: m.name,
        level: m.activation,
        role: label(m.role),
        hue: muscleHue(m.canonicalGroup),
      }))
    : [{ muscle: primary, level: 1, role: "Primary" }]
        .concat(
          secondary.filter(Boolean).map((m) => ({ muscle: m, level: 0.55, role: "Secondary" })),
        )
        .map((w) => ({
          key: `${w.role}-${w.muscle}`,
          label: label(w.muscle),
          level: w.level,
          role: w.role,
          hue: muscleHue(w.muscle),
        }));

  // Map highlights by coarse group — derive from fine data when present.
  const mapPrimary = fine
    ? (fine.find((m) => m.role.toLowerCase() === "primary")?.canonicalGroup ??
      fine[0]!.canonicalGroup)
    : primary;
  const mapSecondary = fine
    ? Array.from(new Set(fine.map((m) => m.canonicalGroup))).filter((g) => g !== mapPrimary)
    : secondary;

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", ...style }} {...rest}>
      {showBody && (
        <MuscleMap
          primary={mapPrimary}
          secondary={mapSecondary}
          size={104}
          style={{
            borderRadius: "var(--radius)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            padding: "8px 6px",
          }}
        />
      )}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          justifyContent: "center",
        }}
      >
        {bars.map((b) => (
          <div key={b.key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{b.label}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                {b.role}
              </span>
            </div>
            <div
              style={{
                height: 7,
                borderRadius: 999,
                background: "var(--surface-2)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(b.level * 100)}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `oklch(0.62 0.14 ${b.hue})`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
