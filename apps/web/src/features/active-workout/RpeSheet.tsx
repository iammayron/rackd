"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";

type Tier = {
  /** Canonical 1–6 value persisted via onChoose — history/progress stay numeric. */
  level: number;
  headline: string;
  description: string;
  /** Easy→hard color. Warm/green end uses semantic tokens; cool low end is inline (no blue token yet). */
  color: string;
};

/**
 * Six perceived-exertion (breathing/talking) levels, easiest → hardest, on a
 * clean 1–6 scale. We persist the single level number; {@link tierForValue}
 * maps any stored value back onto its level, clamping legacy out-of-range logs.
 */
const TIERS: Tier[] = [
  {
    level: 1,
    headline: "Very light",
    description: "Hardly any exertion, but more than sleeping, slow walk, etc.",
    color: "#3b82f6",
  },
  {
    level: 2,
    headline: "Light",
    description: "Feels like you can maintain for hours. Easy to breathe and carry a conversation.",
    color: "#06b6d4",
  },
  {
    level: 3,
    headline: "Moderate",
    description:
      "Breathing heavily, can hold a short conversation. Still somewhat comfortable, but becoming noticeably more challenging.",
    color: "var(--success)",
  },
  {
    level: 4,
    headline: "Vigorous",
    description: "Borderline uncomfortable. Short of breath, can speak a sentence.",
    color: "var(--warning)",
  },
  {
    level: 5,
    headline: "Very hard",
    description:
      "Very difficult to maintain exercise intensity. Can barely breathe and speak only a few words.",
    color: "color-mix(in srgb, var(--danger) 50%, var(--warning))",
  },
  {
    level: 6,
    headline: "Max effort",
    description:
      "Feels almost impossible to keep going. Completely out of breath, unable to talk. Cannot maintain for more than a very short time.",
    color: "var(--danger)",
  },
];

/** The level a stored value falls on (clamped to 1–6 so legacy logs still resolve). */
function tierForValue(v: number | undefined): Tier | null {
  if (v == null) return null;
  const i = Math.min(TIERS.length, Math.max(1, Math.round(v))) - 1;
  return TIERS[i] ?? null;
}

/**
 * The selected-fill color the sheet uses for a given rpe value (reuses
 * {@link tierForValue} / the canonical {@link TIERS} list — no color duplication).
 * Returns null when there's no value, so callers can fall back to a neutral look.
 */
export function rpeColor(v: number | undefined): string | null {
  return tierForValue(v)?.color ?? null;
}

/**
 * RPE picker rendered inside the reusable {@link BottomSheet}: a single row of
 * six color-coded level chips with a live headline + description below. Picking
 * a level persists it (the caller's `onChoose`) but keeps the sheet open so the
 * label stays readable; dismissal is explicit (Done / None / backdrop). Pure UI
 * — persistence and the open flag live with the caller.
 */
export function RpeSheet({
  open,
  value,
  onChoose,
  onClose,
}: {
  open: boolean;
  value: number | undefined;
  onChoose: (v: number | undefined) => void;
  onClose: () => void;
}) {
  // The tier whose meaning is shown below the row: the one under the pointer/
  // focus (preview), else the current selection. Drives the live description.
  const [preview, setPreview] = useState<Tier | null>(null);
  const selected = tierForValue(value);
  const shown = preview ?? selected ?? null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Effort · RPE"
      subtitle="How hard was that set?"
    >
      <div onPointerLeave={() => setPreview(null)}>
        {/* Six levels on one row — equal-width chips that shrink to fit. */}
        <div className="flex gap-1">
          {TIERS.map((tier) => {
            const on = selected === tier;
            return (
              <button
                key={tier.level}
                type="button"
                onClick={() => onChoose(tier.level)}
                onPointerEnter={() => setPreview(tier)}
                onFocus={() => setPreview(tier)}
                onBlur={() => setPreview(null)}
                aria-pressed={on}
                aria-label={`RPE ${tier.level} — ${tier.headline}`}
                className="flex-1 min-w-0 inline-flex items-center justify-center min-h-12 rounded-[var(--radius-sm)] border text-[15px] font-extrabold tabular-nums"
                style={{
                  color: on ? "var(--text-on-accent)" : tier.color,
                  background: on
                    ? tier.color
                    : `color-mix(in srgb, ${tier.color} 12%, transparent)`,
                  borderColor: on
                    ? tier.color
                    : `color-mix(in srgb, ${tier.color} 35%, transparent)`,
                }}
              >
                {tier.level}
              </button>
            );
          })}
        </div>

        {/* Live headline + description of the highlighted level, or a neutral hint. */}
        <div className="mt-3 min-h-12 flex flex-col items-center justify-center gap-1 text-center">
          {shown ? (
            <>
              <div className="flex items-center justify-center gap-2 text-[15px] font-semibold">
                <span className="tabular-nums" style={{ color: shown.color }}>
                  {shown.level}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span style={{ color: shown.color }}>{shown.headline}</span>
              </div>
              <p className="max-w-[42ch] text-[13px] leading-snug text-[var(--text-muted)]">
                {shown.description}
              </p>
            </>
          ) : (
            <span className="text-[15px] font-semibold text-[var(--text-muted)]">
              Tap to rate effort
            </span>
          )}
        </div>

        {/* Picking a level keeps the sheet open (so the label reads); these are
            the explicit exits — None clears, Done confirms and closes. */}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onChoose(undefined)}
            aria-pressed={value == null}
            className={`flex-1 min-h-11 rounded-[var(--radius-md)] border text-[15px] font-semibold ${
              value == null
                ? "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]"
                : "bg-transparent text-[var(--text-muted)] border-[var(--border)]"
            }`}
          >
            None
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-11 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--text-on-accent)] text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            Done
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
