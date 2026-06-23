"use client";

import { mmss } from "@rackd/ui";
import { useTimerStore } from "./timer-store";

const BTN =
  "inline-flex items-center justify-center min-h-11 min-w-11 px-4 rounded-lg bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-base font-semibold disabled:opacity-50";

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
      className={`sticky bottom-0 flex items-center gap-3 py-3 px-4 border-t border-[var(--border)] ${
        fired ? "bg-[var(--success)] text-[#06231a]" : "bg-[var(--surface)] text-[var(--text)]"
      }`}
    >
      <span className="text-xl font-bold min-w-[84px]">
        {fired ? "Rest over" : mmss(remaining)}
      </span>
      <div className="ms-auto flex gap-2">
        <button type="button" className={BTN} onClick={() => add(-15)} disabled={fired}>
          -15s
        </button>
        <button type="button" className={BTN} onClick={() => add(15)} disabled={fired}>
          +15s
        </button>
        <button type="button" className={BTN} onClick={skip}>
          {fired ? "Dismiss" : "Skip"}
        </button>
      </div>
    </div>
  );
}
