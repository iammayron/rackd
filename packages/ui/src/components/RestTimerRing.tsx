"use client";

import * as React from "react";

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export interface RestTimerRingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Total rest in seconds. @default 90 */
  total?: number;
  /** Controlled remaining seconds. When set, the ring does not self-run. */
  remaining?: number;
  /** Self-running countdown when uncontrolled. @default false */
  running?: boolean;
  onComplete?: () => void;
  /** @default 200 */
  size?: number;
  /** @default 14 */
  strokeWidth?: number;
}

/**
 * RestTimerRing — the signature Rackd element. A circular countdown ring that
 * sweeps coral as rest ticks down and flips to green when rest is over. The
 * same arc shape is the Rackd logo.
 *
 * Controlled: pass `remaining` (seconds) + `total`. Self-running: pass `total`
 * + `running` and it counts down on its own, calling `onComplete` at zero.
 *
 * TODO(phase-3): wire to @rackd/core timer FSM (remainingMs) so the self-running
 * mode shares the wall-clock state instead of its own rAF loop.
 */
export function RestTimerRing({
  total = 90,
  remaining,
  running = false,
  onComplete,
  size = 200,
  strokeWidth = 14,
  style,
  ...rest
}: RestTimerRingProps) {
  const controlled = remaining != null;
  const [internal, setInternal] = React.useState(total);
  const endRef = React.useRef(0);

  React.useEffect(() => {
    if (controlled || !running) return;
    setInternal(total);
    endRef.current = Date.now() + total * 1000;
    let raf = 0;
    const tick = () => {
      const left = (endRef.current - Date.now()) / 1000;
      setInternal(left);
      if (left <= 0) {
        onComplete?.();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, total, controlled, onComplete]);

  const left = controlled ? (remaining as number) : internal;
  const fired = left <= 0;
  const frac = Math.max(0, Math.min(1, left / total));

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const ringColor = fired ? "var(--success)" : "var(--accent)";

  return (
    <div
      style={{ position: "relative", width: size, height: size, fontFamily: "var(--font-sans)", ...style }}
      {...rest}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 250ms linear, stroke var(--dur) var(--ease-out)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: fired ? "var(--success)" : "var(--text-muted)",
          }}
        >
          {fired ? "Rest over" : "Rest"}
        </span>
        <span
          style={{
            fontSize: size * 0.28,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            fontVariantNumeric: "tabular-nums lining-nums",
          }}
        >
          {fired ? "0:00" : mmss(left)}
        </span>
      </div>
    </div>
  );
}
