"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "@rackd/ui";
import type { SessionDiff } from "@rackd/core";

export type SaveBackMode = "numbers" | "exercises" | "everything";
export type SaveBackTarget = "here" | "everywhere";

/**
 * Save-back sheet (#3). Shown after finishing only when the session diverged
 * from the routine's prescription. Lets the user push changes back — reps &
 * weights, the new exercise lineup, or everything — and (when the routine is in
 * the active program) choose whether it applies to just this program or
 * everywhere. "Just log it" skips straight to the summary.
 */
export function SaveBackSheet({
  diff,
  routineName,
  programName,
  onSkip,
  onSave,
}: {
  diff: SessionDiff;
  routineName: string;
  /** Active-program name when the routine is scheduled in it; enables the target toggle. */
  programName?: string | null;
  onSkip: () => void;
  onSave: (mode: SaveBackMode, target: SaveBackTarget) => void;
}) {
  const both = diff.exercisesChanged && diff.numbersChanged;
  const [mode, setMode] = useState<SaveBackMode>(
    both ? "everything" : diff.exercisesChanged ? "exercises" : "numbers",
  );
  const [target, setTarget] = useState<SaveBackTarget>(programName ? "here" : "everywhere");
  const [saving, setSaving] = useState(false);

  const options: { v: SaveBackMode; t: string; d: string }[] = [];
  if (diff.numbersChanged)
    options.push({
      v: "numbers",
      t: "Update reps & weights",
      d: "Keep the same exercises — save the loads you actually hit as the new targets.",
    });
  if (diff.exercisesChanged)
    options.push({
      v: "exercises",
      t: "Save exercise changes",
      d: "Adopt the exercises you added or swapped; keep the prescribed numbers.",
    });
  options.push({
    v: "everything",
    t: "Update everything",
    d: "Save the exercises and the numbers exactly as performed.",
  });

  function save() {
    if (saving) return;
    setSaving(true);
    onSave(mode, programName ? target : "everywhere");
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <div
        onClick={onSkip}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-label="Save changes"
        className="relative w-[min(440px,100%)] max-h-[92vh] flex flex-col overflow-hidden bg-[var(--bg)] rounded-t-[22px] shadow-[var(--shadow-lg)]"
      >
        <div className="pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-[38px] h-[5px] rounded-full bg-[var(--border)]" />
        </div>
        <div className="overflow-y-auto px-5 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))]">
          <h2 className="mt-1 mb-0.5 text-[19px] font-extrabold">
            Save changes to {routineName}?
          </h2>
          <p className="mt-0 mb-4 text-[13.5px] text-[var(--text-muted)] leading-snug">
            You changed this workout from its plan. Choose what to keep — or just log it as a
            one-off.
          </p>

          <div className="flex flex-col gap-2.5 mb-[18px]">
            {options.map((o) => {
              const on = mode === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setMode(o.v)}
                  className={`flex gap-3 items-start text-left p-3.5 rounded-[var(--radius-md)] cursor-pointer ${
                    on
                      ? "bg-[var(--accent-wash)] border border-[var(--accent)]"
                      : "bg-[var(--surface)] border border-[var(--border)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-px shrink-0 w-5 h-5 rounded-full bg-[var(--surface)] box-border"
                    style={{ border: on ? "6px solid var(--accent)" : "2px solid var(--border)" }}
                  />
                  <span className="min-w-0">
                    <span className="block font-bold text-[15px]">{o.t}</span>
                    <span className="block text-[13px] text-[var(--text-muted)] mt-0.5 leading-snug">
                      {o.d}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {programName && (
            <div className="mb-[18px]">
              <div className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--text-muted)] mb-2">
                Apply to
              </div>
              <SegmentedControl
                options={[
                  { value: "here", label: "This program" },
                  { value: "everywhere", label: "Everywhere" },
                ]}
                value={target}
                onChange={(v) => setTarget(v as SaveBackTarget)}
                size="sm"
                style={{ display: "flex", width: "100%" }}
              />
              <p className="mt-2 mx-0.5 text-[12.5px] text-[var(--text-muted)] leading-snug">
                {target === "here"
                  ? `Only ${programName} changes — it gets its own copy of the routine. The shared routine and other programs stay as they are.`
                  : "Every program that uses this routine gets the change."}
              </p>
            </div>
          )}

          <Button variant="primary" size="lg" fullWidth disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="ghost" fullWidth onClick={onSkip} style={{ marginTop: 8 }}>
            Just log it
          </Button>
        </div>
      </div>
    </div>
  );
}
