"use client";

import { useEffect, useState } from "react";
import { plateBreakdown, startTimer, remainingMs, type TimerState } from "@fitnow/core";
import { mmss } from "@fitnow/ui";

/**
 * Placeholder home that proves the wiring: core logic (plate calc + wall-clock
 * timer) imported into the web shell. Real screens replace this next.
 */
export default function Home() {
  const plates = plateBreakdown(100, 20);

  const [timer, setTimer] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => 0);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timer]);

  const left = timer ? remainingMs(timer, now) : 0;

  return (
    <main style={{ padding: "var(--space-6)" }}>
      <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>FitNow</h1>
      <p style={{ color: "var(--text-muted)" }}>Local-first workout tracker — scaffold.</p>

      <section
        style={{
          marginTop: "var(--space-6)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
        }}
      >
        <h2 style={{ fontSize: "var(--text-lg)" }}>Plate calc — 100kg</h2>
        <p style={{ fontSize: "var(--text-lg)", color: "var(--accent)" }}>
          Per side: {plates.perSide.join(" + ")} kg
        </p>
      </section>

      <section
        style={{
          marginTop: "var(--space-4)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-4)",
        }}
      >
        <h2 style={{ fontSize: "var(--text-lg)" }}>Rest timer</h2>
        <p style={{ fontSize: "var(--text-xl)", fontWeight: 700 }}>{mmss(left)}</p>
        <button
          onClick={() => {
            const t = Date.now();
            setNow(t);
            setTimer(startTimer(90, t));
          }}
          style={{
            minHeight: "var(--tap-min)",
            padding: "0 var(--space-6)",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--radius)",
            fontSize: "var(--text-base)",
            fontWeight: 600,
          }}
        >
          Start 90s rest
        </button>
      </section>
    </main>
  );
}
