"use client";

import * as React from "react";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** @default "neutral" */
  tone?: BadgeTone;
  /** Fill with the tone color instead of a soft tint. @default false */
  solid?: boolean;
  children?: React.ReactNode;
}

/**
 * Small status pill. Tone maps to the semantic palette. `solid` fills, default
 * is a soft tint. Used for "PR", "Superset", muscle/equipment tags, rest secs.
 */
export function Badge({ children, tone = "neutral", solid = false, style, ...rest }: BadgeProps) {
  const tones: Record<BadgeTone, { fg: string; bg: string }> = {
    neutral: { fg: "var(--text-muted)", bg: "var(--surface-2)" },
    accent: { fg: "var(--accent)", bg: "var(--accent-wash)" },
    success: { fg: "var(--success)", bg: "color-mix(in srgb, var(--success) 16%, transparent)" },
    warning: { fg: "var(--warning)", bg: "color-mix(in srgb, var(--warning) 18%, transparent)" },
    danger: { fg: "var(--danger)", bg: "color-mix(in srgb, var(--danger) 16%, transparent)" },
  };
  const t = tones[tone] ?? tones.neutral;
  const solidFg = tone === "success" ? "var(--success-ink)" : tone === "accent" ? "var(--text-on-accent)" : "#fff";
  const solidBg = `var(--${tone === "neutral" ? "text-muted" : tone === "accent" ? "accent" : tone})`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 24,
        padding: "0 10px",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: "0.01em",
        borderRadius: "var(--radius-pill)",
        color: solid ? solidFg : t.fg,
        background: solid ? solidBg : t.bg,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
