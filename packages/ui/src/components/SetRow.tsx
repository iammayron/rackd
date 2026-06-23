"use client";

import * as React from "react";

// RPE (rate of perceived exertion) visual language: green = easy → red = max.
const RPE_TRACK = "linear-gradient(90deg, #1f9d57 0%, #d9a300 46%, #ef6c1a 74%, #dc2626 100%)";
const rpeColor = (v: number) => (v <= 7 ? "#1f9d57" : v <= 8 ? "#c79200" : v <= 9 ? "#ef6c1a" : "#dc2626");
const rpeLabel = (v: number) =>
  v <= 6.5 ? "Easy" : v <= 7.5 ? "Moderate" : v <= 8.5 ? "Hard" : v <= 9.5 ? "Very hard" : "Max effort";

export interface SetRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle"> {
  /** @default 1 */
  index?: number;
  /** Previous performance label (e.g. "95×8"). */
  prev?: string;
  weight?: string;
  reps?: string;
  /** @default "kg" */
  unit?: string;
  /** @default false */
  completed?: boolean;
  /** Current effort 6–10, or null when unset. */
  rpe?: number | null;
  /** Provide to enable the RPE chip; called with a value or null (clear). */
  onRpe?: (value: number | null) => void;
  onWeight?: (value: string) => void;
  onReps?: (value: string) => void;
  onToggle?: () => void;
}

/**
 * One set row in a live workout: index, previous performance, weight + reps
 * inputs, and a big complete toggle. Completing turns the check green — that's
 * the moment that starts the rest timer in the real app.
 */
export function SetRow({
  index = 1,
  prev,
  weight = "",
  reps = "",
  unit = "kg",
  completed = false,
  rpe = null,
  onRpe,
  onWeight,
  onReps,
  onToggle,
  style,
  ...rest
}: SetRowProps) {
  const [rpeOpen, setRpeOpen] = React.useState(false);
  const [rpeDrag, setRpeDrag] = React.useState(false);
  const rpeTrackRef = React.useRef<HTMLDivElement>(null);
  const setRpeFromX = (clientX: number) => {
    const r = rpeTrackRef.current?.getBoundingClientRect();
    if (!r) return;
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onRpe?.(Math.round((6 + ratio * 4) * 2) / 2);
  };
  const cell: React.CSSProperties = {
    width: 64,
    minHeight: "var(--tap-min)",
    textAlign: "center",
    fontFamily: "var(--font-sans)",
    fontSize: 18,
    fontWeight: 600,
    color: "var(--text)",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    outline: "none",
    fontVariantNumeric: "tabular-nums",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 0",
        opacity: completed ? 0.75 : 1,
        fontFamily: "var(--font-sans)",
        ...style,
      }}
      {...rest}
    >
      <span style={{ width: 22, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{index}</span>
      <span style={{ width: 78, fontSize: 13, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {prev || "—"}
      </span>
      <input
        style={cell}
        inputMode="decimal"
        placeholder={unit}
        value={weight}
        onChange={(e) => onWeight?.(e.target.value)}
        aria-label={`Set ${index} weight`}
      />
      <input
        style={cell}
        inputMode="numeric"
        placeholder="reps"
        value={reps}
        onChange={(e) => onReps?.(e.target.value)}
        aria-label={`Set ${index} reps`}
      />
      {onRpe && (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setRpeOpen((o) => !o)}
            aria-label={`Set ${index} effort (RPE)`}
            style={{
              minWidth: 40,
              height: "var(--tap-min)",
              padding: "0 8px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontWeight: 800,
              fontSize: rpe != null ? 15 : 11,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              color: rpe != null ? rpeColor(rpe) : "var(--text-muted)",
              background: rpe != null ? `color-mix(in srgb, ${rpeColor(rpe)} 15%, transparent)` : "var(--surface-2)",
              border: rpe != null ? `1px solid color-mix(in srgb, ${rpeColor(rpe)} 38%, transparent)` : "1px solid var(--border)",
            }}
          >
            {rpe != null ? rpe : "RPE"}
          </button>
          {rpeOpen && (
            <>
              <div onClick={() => setRpeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  right: 0,
                  zIndex: 50,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: 14,
                  width: 226,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Effort · RPE
                  </span>
                  {rpe != null && (
                    <button
                      type="button"
                      onClick={() => onRpe(null)}
                      style={{
                        marginLeft: "auto",
                        border: "none",
                        background: "transparent",
                        color: "var(--text-muted)",
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                  <span
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      lineHeight: 1,
                      fontVariantNumeric: "tabular-nums",
                      color: rpe != null ? rpeColor(rpe) : "var(--text-muted)",
                    }}
                  >
                    {rpe != null ? rpe : "–"}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: rpe != null ? rpeColor(rpe) : "var(--text-muted)" }}>
                    {rpe != null ? rpeLabel(rpe) : "Drag to rate"}
                  </span>
                </div>
                <div
                  ref={rpeTrackRef}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setRpeDrag(true);
                    setRpeFromX(e.clientX);
                  }}
                  onPointerMove={(e) => {
                    if (rpeDrag) setRpeFromX(e.clientX);
                  }}
                  onPointerUp={() => setRpeDrag(false)}
                  onPointerCancel={() => setRpeDrag(false)}
                  style={{
                    position: "relative",
                    height: 14,
                    borderRadius: 999,
                    background: RPE_TRACK,
                    cursor: "pointer",
                    touchAction: "none",
                    opacity: rpe != null ? 1 : 0.45,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: `${(((rpe != null ? rpe : 8) - 6) / 4) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: "#fff",
                      border: `3px solid ${rpe != null ? rpeColor(rpe) : "#9aa6b4"}`,
                      boxShadow: "var(--shadow)",
                      display: rpe != null || rpeDrag ? "block" : "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  <span>6</span>
                  <span>8</span>
                  <span>10</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={completed ? "Mark set incomplete" : "Complete set"}
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "var(--tap-min)",
          minHeight: "var(--tap-min)",
          fontSize: 20,
          fontWeight: 800,
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          cursor: "pointer",
          color: completed ? "var(--success-ink)" : "var(--text)",
          background: completed ? "var(--success)" : "var(--surface-2)",
          transition: "background var(--dur) var(--ease-out)",
        }}
      >
        ✓
      </button>
    </div>
  );
}
