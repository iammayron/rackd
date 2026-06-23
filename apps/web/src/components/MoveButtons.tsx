"use client";

/** Up/down reorder controls — touch-friendly alternative to drag. */
export function MoveButtons({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
}) {
  const btn =
    "flex items-center justify-center w-7 h-5 text-xs text-[var(--text-muted)] disabled:opacity-30";
  return (
    <div className="flex flex-col -space-y-0.5">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
        ▲
      </button>
      <button
        type="button"
        className={btn}
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label="Move down"
      >
        ▼
      </button>
    </div>
  );
}
