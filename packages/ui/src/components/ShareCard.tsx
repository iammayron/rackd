"use client";

import * as React from "react";

export type ShareCardTheme = "accent" | "dark" | "light";

export interface ShareCardData {
  /** Workout name, e.g. "Push Day". */
  name: string;
  /** Pre-formatted date, e.g. "Sat, Jun 21". */
  date: string;
  /** Pre-formatted volume value (display units already applied), e.g. "12,480". */
  volume: string;
  /** Unit label for the volume, e.g. "kg" / "lb". */
  volumeUnit: string;
  /** Pre-formatted duration, e.g. "52 min" / "1h 04m". */
  duration: string;
  sets: number;
  prCount: number;
  /** Optional headline set, e.g. "Bench Press · 100kg × 8". */
  topSet?: string;
}

export interface ShareCardProps extends React.HTMLAttributes<HTMLDivElement> {
  data: ShareCardData;
  theme?: ShareCardTheme;
}

/**
 * Shareable workout card — the branded composition a user exports as an image.
 * Self-contained (inline styles + token vars) so it rasterizes cleanly via
 * html-to-image. Three themes: coral (accent), dark, light.
 */
export function ShareCard({ data, theme = "accent", style, ...rest }: ShareCardProps) {
  const dark = theme === "dark";
  const bg =
    theme === "accent"
      ? "linear-gradient(155deg, var(--accent) 0%, var(--accent-press) 100%)"
      : dark
        ? "#11161d"
        : "var(--surface)";
  const ink = theme === "accent" || dark ? "#fff" : "var(--text)";
  const sub = theme === "accent" ? "rgba(255,255,255,0.82)" : "var(--text-muted)";
  const hair = theme === "accent" ? "rgba(255,255,255,0.22)" : "var(--border)";
  const whiteMark = theme === "accent" || dark;

  const Stat = ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: sub, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, fontWeight: 700, color: sub }}>{unit}</span>}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "4 / 5",
        borderRadius: "var(--radius-md)",
        background: bg,
        color: ink,
        padding: 22,
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-lg)",
        overflow: "hidden",
        border: theme === "light" ? "1px solid var(--border)" : "none",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <img
          src="/assets/logo-mark.svg"
          width={22}
          height={22}
          alt=""
          style={{ display: "block", filter: whiteMark ? "brightness(0) invert(1)" : "none" }}
        />
        <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em" }}>Rackd</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: sub, whiteSpace: "nowrap" }}>
          {data.date}
        </span>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: sub, whiteSpace: "nowrap" }}>
          Workout complete
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, marginTop: 4, letterSpacing: "-0.01em" }}>
          {data.name}
        </div>
      </div>

      <div style={{ height: 1, background: hair, margin: "18px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", rowGap: 16, columnGap: 12 }}>
        <Stat label="Volume" value={data.volume} unit={data.volumeUnit} />
        <Stat label="Duration" value={data.duration} />
        <Stat label="Sets" value={data.sets} />
        <Stat label="PRs" value={data.prCount} unit={data.prCount === 1 ? "record" : "records"} />
      </div>

      {data.topSet && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: "var(--radius)",
            background: theme === "accent" ? "rgba(0,0,0,0.20)" : "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Top set · {data.topSet}
          </span>
        </div>
      )}
    </div>
  );
}
