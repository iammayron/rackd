"use client";

import { RestTimerRing, Button, mmss } from "@rackd/ui";
import { useTimerStore } from "./timer-store";

/**
 * Rest dock: the signature RestTimerRing as a bare progress dial with the
 * countdown beside it. Controlled by the wall-clock timer store (recomputes
 * remaining each tick; never counts ticks). The dial flips green on fire, then
 * the store auto-dismisses.
 *
 * Deliberately NON-blocking — no scrim, no scroll lock, no `aria-modal`.
 * Resting shouldn't trap you on the current set: you can still scroll, peek at
 * the next exercise, or reorder while the clock runs.
 *
 * `sticky`, not `fixed`, and that matters: iOS WebKit intermittently fails to
 * lay out `position: fixed` overlays and paints them stranded mid-page (see
 * `ForegroundReflow`, which papers over the same bug on resume — but this bar
 * mounts mid-session when a set is completed, so nothing triggers that reflow).
 * Sticky anchors to the viewport without the bug, which is why the tab bar uses
 * it too. It also centres without a transform, so the `rk-sheet-up` entrance
 * can't clobber the centring the way `-translate-x-1/2` did.
 */
export function RestTimerBar() {
  const state = useTimerStore((s) => s.state);
  const fired = useTimerStore((s) => s.fired);
  // subscribe to `now` so the dial re-renders each tick
  useTimerStore((s) => s.now);
  const remaining = useTimerStore((s) => s.remaining());
  const add = useTimerStore((s) => s.add);
  const skip = useTimerStore((s) => s.skip);

  if (state.status === "idle") return null;

  const total = (state.durationMs || 1) / 1000;

  return (
    <div
      role="region"
      aria-label="Rest timer"
      className="sticky bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] rk-sheet-up"
    >
      {/* flex-wrap is a safety valve: on a very narrow phone the controls drop
          to a second row instead of crowding the countdown or overflowing. */}
      <div className="mx-auto flex max-w-[440px] flex-wrap items-center gap-y-2 gap-x-3 px-4 pt-3 pb-[calc(12px+var(--safe-bottom))]">
        <RestTimerRing
          remaining={Math.ceil(remaining / 1000)}
          total={total}
          fired={fired}
          showLabel={false}
          size={38}
          strokeWidth={5}
        />
        <div className="flex min-w-0 flex-col leading-none">
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.08em] ${
              fired ? "text-[var(--success)]" : "text-[var(--text-muted)]"
            }`}
          >
            {fired ? "Rest over" : "Rest"}
          </span>
          <span className="mt-1 text-xl font-extrabold leading-none tabular-nums text-[var(--text)]">
            {fired ? "0:00" : mmss(remaining)}
          </span>
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2 ps-2">
          <Button variant="secondary" size="sm" onClick={() => add(-15)} disabled={fired}>
            −15s
          </Button>
          <Button variant="secondary" size="sm" onClick={() => add(15)} disabled={fired}>
            +15s
          </Button>
          <Button variant="ghost" size="sm" onClick={skip}>
            {fired ? "Dismiss" : "Skip"}
          </Button>
        </div>
      </div>
    </div>
  );
}
