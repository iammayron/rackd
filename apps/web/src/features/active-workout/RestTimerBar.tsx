"use client";

import { useEffect } from "react";
import { RestTimerRing, Button } from "@rackd/ui";
import { useTimerStore } from "./timer-store";

/**
 * Rest panel built around the signature RestTimerRing. Controlled by the
 * wall-clock timer store (recomputes remaining each tick; never counts ticks).
 * The ring flips green on fire, then the store auto-dismisses.
 *
 * Rendered as a focused bottom overlay over a dimmed backdrop so rest reads as
 * a distinct moment, not a flat sticky bar. The backdrop is intentionally
 * visual-only (no dismiss-on-tap) — an accidental scrim tap must never skip
 * your rest. Exit is explicit: "Skip rest", or auto-close once fired.
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

  // Lock background scroll while the rest overlay is up — it's a modal moment,
  // so a stray scroll behind the dim scrim shouldn't move the page. Released
  // automatically on skip or when the timer auto-dismisses after firing.
  useEffect(() => {
    if (!visible) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, [visible]);

  if (!visible) return null;

  const total = (state.durationMs || 1) / 1000;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end touch-none"
      role="dialog"
      aria-modal="true"
      aria-label="Rest timer"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/50 rk-backdrop-in" />
      <div className="relative flex flex-col items-center gap-3 px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] border-t border-[var(--border)] bg-[var(--surface)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-lg)] rk-sheet-up">
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
    </div>
  );
}
