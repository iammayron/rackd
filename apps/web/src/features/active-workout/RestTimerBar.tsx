"use client";

import { RestTimerRing, Button } from "@rackd/ui";
import { useTimerStore } from "./timer-store";

/**
 * Sticky rest panel built around the signature RestTimerRing. Controlled by
 * the wall-clock timer store (recomputes remaining each tick; never counts
 * ticks). The ring flips green on fire.
 */
export function RestTimerBar() {
  const state = useTimerStore((s) => s.state);
  const fired = useTimerStore((s) => s.fired);
  // subscribe to `now` so the ring re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const add = useTimerStore((s) => s.add);
  const skip = useTimerStore((s) => s.skip);

  if (state.status === "idle") return null;

  const total = (state.durationMs || 1) / 1000;

  return (
    <div className="sticky bottom-0 z-20 flex flex-col items-center gap-3 py-4 px-5 border-t border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
      <RestTimerRing
        remaining={Math.ceil(remaining / 1000)}
        total={total}
        fired={fired}
        size={104}
        strokeWidth={11}
      />
      <div className="flex gap-2 w-full">
        <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => add(-15)} disabled={fired}>
          −15s
        </Button>
        <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => add(15)} disabled={fired}>
          +15s
        </Button>
      </div>
      <Button variant="ghost" size="sm" fullWidth onClick={skip}>
        {fired ? "Dismiss" : "Skip rest"}
      </Button>
    </div>
  );
}
