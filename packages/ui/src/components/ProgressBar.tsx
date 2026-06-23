"use client";

import * as React from "react";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. @default 0 */
  value?: number;
  /** @default "accent" */
  tone?: "accent" | "success";
  /** Track height in px. @default 8 */
  height?: number;
}

/**
 * Thin progress bar — weekly-volume goal, weight-to-goal, etc. Rounded track
 * (surface-2) with a coral fill. `tone="success"` for completed goals.
 */
export function ProgressBar({ value = 0, tone = "accent", height = 8, style, ...rest }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = tone === "success" ? "var(--success)" : "var(--accent)";
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: "100%",
        height,
        background: "var(--surface-2)",
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: fill,
          borderRadius: "var(--radius-pill)",
          transition: "width var(--dur-slow) var(--ease-out)",
        }}
      />
    </div>
  );
}
