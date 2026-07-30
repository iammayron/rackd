"use client";

import { RestTimerRing, Button } from "@rackd/ui";
import { useTimerStore } from "./timer-store";

/**
 * Rest dock built around the signature RestTimerRing. Controlled by the
 * wall-clock timer store (recomputes remaining each tick; never counts ticks).
 * The ring flips green on fire, then the store auto-dismisses.
 *
 * Deliberately NON-blocking: a compact floating card docked at the bottom, with
 * no scrim, no scroll lock, and no `aria-modal`. Resting shouldn't trap you on
 * the current set — you can still scroll the list, peek at the next exercise, or
 * reorder while the clock runs. Exit stays explicit ("Skip rest") or auto-closes
 * once fired. The workout page pads its content so nothing hides behind the dock.
 */
export function RestTimerBar() {
  const state = useTimerStore((s) => s.state);
  const fired = useTimerStore((s) => s.fired);
  // subscribe to `now` so the ring re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const add = useTimerStore((s) => s.add);
  const skip = useTimerStore((s) => s.skip);

  const visible = state.status !== "idle";
  if (!visible) return null;

  const total = (state.durationMs || 1) / 1000;

  return (
    <div
      role="region"
      aria-label="Rest timer"
      className="fixed bottom-[calc(12px+var(--safe-bottom))] left-1/2 z-40 -translate-x-1/2 w-[min(440px,calc(100%-24px))] flex flex-wrap items-center gap-3 px-3 py-3 border border-[var(--border)] bg-[var(--surface)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] rk-sheet-up"
    >
      <RestTimerRing
        remaining={Math.ceil(remaining / 1000)}
        total={total}
        fired={fired}
        size={56}
        strokeWidth={7}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => add(-15)}
          disabled={fired}
        >
          −15s
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => add(15)}
          disabled={fired}
        >
          +15s
        </Button>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={skip}
        style={{ marginInlineStart: "auto" }}
      >
        {fired ? "Dismiss" : "Skip rest"}
      </Button>
    </div>
  );
}
