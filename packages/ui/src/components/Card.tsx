"use client";

import * as React from "react";

export type CardVariant = "default" | "feature" | "accent" | "dashed";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "default" */
  variant?: CardVariant;
  /** Inner padding in px. @default 20 */
  padding?: number;
  children?: React.ReactNode;
}

/**
 * Rackd surface card. Soft radius + 1px border + soft shadow (light) / border
 * step (dark). `feature` uses the larger hero radius; `accent` paints coral
 * (used for "today's workout"). `dashed` for empty / add states.
 */
export function Card({ children, variant = "default", padding = 20, style, className, ...rest }: CardProps) {
  const variants: Record<CardVariant, React.CSSProperties> = {
    default: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-sm)",
    },
    feature: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow)",
    },
    accent: {
      background: "var(--accent)",
      color: "var(--text-on-accent)",
      border: "1px solid transparent",
      borderRadius: "var(--radius-xl)",
      boxShadow: "var(--shadow-accent)",
    },
    dashed: {
      background: "var(--surface)",
      border: "1px dashed var(--border)",
      borderRadius: "var(--radius-lg)",
    },
  };
  const v = variants[variant] ?? variants.default;
  return (
    <div
      className={["rk-squircle-corners", className].filter(Boolean).join(" ")}
      style={{ padding, fontFamily: "var(--font-sans)", color: "var(--text)", ...v, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
