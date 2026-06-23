"use client";

import { mmss } from "@fitnow/ui";
import { useTimerStore } from "./timer-store";

const btn: React.CSSProperties = {
  minHeight: "var(--tap-min)",
  minWidth: "var(--tap-min)",
  padding: "0 var(--space-4)",
  background: "var(--surface-2)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: "var(--text-base)",
  fontWeight: 600,
};

/** Sticky rest timer. Hidden when idle; turns green-ish on fire. */
export function RestTimerBar() {
  const state = useTimerStore((s) => s.state);
  const fired = useTimerStore((s) => s.fired);
  // subscribe to `now` so the label re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const add = useTimerStore((s) => s.add);
  const skip = useTimerStore((s) => s.skip);

  if (state.status === "idle") return null;

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: fired ? "var(--success)" : "var(--surface)",
        color: fired ? "#06231a" : "var(--text)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: "var(--text-xl)", fontWeight: 700, minWidth: 84 }}>
        {fired ? "Rest over" : mmss(remaining)}
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
        <button style={btn} onClick={() => add(-15)} disabled={fired}>
          -15s
        </button>
        <button style={btn} onClick={() => add(15)} disabled={fired}>
          +15s
        </button>
        <button style={btn} onClick={skip}>
          {fired ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
