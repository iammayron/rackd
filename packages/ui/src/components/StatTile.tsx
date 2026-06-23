"use client";

import * as React from "react";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  caption?: React.ReactNode;
  /** Big number color. @default "accent" */
  tone?: "accent" | "plain";
}

/**
 * Dashboard stat tile: an eyebrow label over a big tabular number with an
 * optional unit + caption. The number rides coral by default (accent), or
 * inherits text color when `tone="plain"`.
 */
export function StatTile({ label, value, unit, caption, tone = "accent", style, ...rest }: StatTileProps) {
  return (
    <div style={{ fontFamily: "var(--font-sans)", ...style }} {...rest}>
      {label && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow)",
            color: "var(--text-muted)",
            marginBottom: 4,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
        <span
          style={{
            fontSize: "var(--text-2xl)",
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: tone === "accent" ? "var(--accent)" : "var(--text)",
            fontVariantNumeric: "tabular-nums lining-nums",
          }}
        >
          {value}
        </span>
        {unit && <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--text-muted)" }}>{unit}</span>}
      </div>
      {caption && <div style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>{caption}</div>}
    </div>
  );
}
