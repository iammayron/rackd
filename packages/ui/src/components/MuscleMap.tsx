"use client";

import * as React from "react";
import { muscleHue } from "./MuscleVisualizer";
import { ANTERIOR, POSTERIOR, type MusclePolygons } from "./muscle-map-paths";

/**
 * Self-owned anatomical muscle map — front + back figures whose muscle regions
 * highlight by @rackd/core MuscleGroup. No external API, no runtime dependency:
 * SVG polygons (vendored from react-body-highlighter, MIT — see
 * muscle-map-paths.ts) tinted by our highlight logic. Themeable + offline.
 *
 * Each worked region is tinted by its own muscle hue (matching the bars in
 * MuscleVisualizer): primary at full intensity, secondary at reduced opacity,
 * everything else a faint neutral so the body still reads as a body.
 */

type Role = "primary" | "secondary" | "none";

/** Faint body fill for muscles this exercise doesn't work. */
const BASE_FILL = "color-mix(in oklch, var(--text-muted) 22%, transparent)";

/**
 * Source muscle key → our coarse MuscleGroup. Keys not present here (neck, head,
 * knees, abductors/adductor) never highlight — they only draw the silhouette.
 */
const RBH_TO_GROUP: Record<string, string> = {
  chest: "chest",
  obliques: "abs",
  abs: "abs",
  biceps: "biceps",
  triceps: "triceps",
  "front-deltoids": "shoulders",
  "back-deltoids": "shoulders",
  quadriceps: "quads",
  calves: "calves",
  forearm: "forearms",
  trapezius: "traps",
  "upper-back": "back",
  "lower-back": "back",
  gluteal: "glutes",
  hamstring: "hamstrings",
  "left-soleus": "calves",
  "right-soleus": "calves",
};

export interface MuscleMapProps extends Omit<React.SVGProps<SVGSVGElement>, "primary"> {
  /** Primary mover (full-intensity highlight). */
  primary: string;
  /** Assisting groups (reduced-intensity highlight). */
  secondary?: string[];
  /** Pixel height; width scales to the 2-figure aspect. */
  size?: number;
}

export function MuscleMap({ primary, secondary = [], size = 104, style, ...rest }: MuscleMapProps) {
  const p = (primary ?? "").toLowerCase();
  const sec = new Set(secondary.filter(Boolean).map((m) => m.toLowerCase()));
  const full = p === "fullbody";

  const roleFor = (group: string | undefined): Role => {
    if (!group) return "none";
    if (full) return "primary";
    if (group === p) return "primary";
    if (sec.has(group)) return "secondary";
    return "none";
  };

  const renderFigure = (data: MusclePolygons[], offsetX: number) => (
    <g transform={`translate(${offsetX} 0)`}>
      {data.map((region) => {
        const group = RBH_TO_GROUP[region.muscle];
        const role = roleFor(group);
        const fill = role === "none" ? BASE_FILL : `oklch(0.64 0.15 ${muscleHue(group!)})`;
        const opacity = role === "secondary" ? 0.55 : 1;
        return (
          <g key={region.muscle} fill={fill} fillOpacity={opacity}>
            {region.points.map((pts, i) => (
              <polygon key={i} points={pts} />
            ))}
          </g>
        );
      })}
    </g>
  );

  return (
    <svg
      viewBox="0 0 210 220"
      height={size}
      role="img"
      aria-label="Muscles worked"
      style={{ flexShrink: 0, ...style }}
      {...rest}
    >
      {renderFigure(ANTERIOR, 0)}
      {renderFigure(POSTERIOR, 110)}
    </svg>
  );
}
