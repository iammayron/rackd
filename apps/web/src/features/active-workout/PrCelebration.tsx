"use client";

import { useUnit } from "@/lib/units-store";

interface DetectedPR {
  exerciseId: string;
  type: "1rm" | "weight";
  value: number;
}

/**
 * Celebration overlay shown when a finished workout sets new PRs.
 * Centered card over a backdrop (Preline-style overlay).
 */
export function PrCelebration({
  prs,
  nameById,
  onClose,
}: {
  prs: DetectedPR[];
  nameById: Record<string, string>;
  onClose: () => void;
}) {
  const { unit, display } = useUnit();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60">
      <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-xl font-bold mb-1">New PR{prs.length > 1 ? "s" : ""}!</h2>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          {prs.length} record{prs.length > 1 ? "s" : ""} this workout.
        </p>

        <ul className="list-none p-0 m-0 mb-6 space-y-2">
          {prs.map((pr, i) => (
            <li
              key={i}
              className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg py-2 px-3 text-start"
            >
              <span className="flex-1 font-semibold">{nameById[pr.exerciseId] ?? "Exercise"}</span>
              <span className="text-sm text-[var(--text-muted)]">
                {pr.type === "1rm" ? "est 1RM" : "top"}
              </span>
              <strong className="text-[var(--accent)]">
                {display(pr.value)} {unit}
              </strong>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="min-h-11 w-full rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-press)]"
        >
          Let&apos;s go 💪
        </button>
      </div>
    </div>
  );
}
