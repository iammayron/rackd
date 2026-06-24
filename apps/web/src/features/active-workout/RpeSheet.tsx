"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";

type Tier = {
  /** Chip label / heading shown in the row (e.g. "2–3"). */
  rangeLabel: string;
  headline: string;
  description: string;
  /** Easy→hard color. Warm/green end uses semantic tokens; cool low end is inline (no blue token yet). */
  color: string;
  /** Single canonical rpe persisted via onChoose — history/progress stay numeric. */
  store: number;
  /** Inclusive [min, max] of legacy 1–10 values this tier represents (for highlighting prior logs). */
  match: [number, number];
};

/**
 * Six perceived-exertion (breathing/talking) tiers matching the classic RPE
 * chart, easiest → hardest. We still persist a single rpe number (`store`) so
 * previously logged 1–10 values stay valid; `match` maps any such number back
 * onto its tier for highlighting.
 */
const TIERS: Tier[] = [
  {
    rangeLabel: "1",
    headline: "Very light",
    description: "Hardly any exertion, but more than sleeping, slow walk, etc.",
    color: "#3b82f6",
    store: 1,
    match: [1, 1],
  },
  {
    rangeLabel: "2–3",
    headline: "Light",
    description: "Feels like you can maintain for hours. Easy to breathe and carry a conversation.",
    color: "#06b6d4",
    store: 3,
    match: [2, 3],
  },
  {
    rangeLabel: "4–6",
    headline: "Moderate",
    description:
      "Breathing heavily, can hold a short conversation. Still somewhat comfortable, but becoming noticeably more challenging.",
    color: "var(--success)",
    store: 5,
    match: [4, 6],
  },
  {
    rangeLabel: "7–8",
    headline: "Vigorous",
    description: "Borderline uncomfortable. Short of breath, can speak a sentence.",
    color: "var(--warning)",
    store: 8,
    match: [7, 8],
  },
  {
    rangeLabel: "9",
    headline: "Very hard",
    description: "Very difficult to maintain exercise intensity. Can barely breathe and speak only a few words.",
    color: "color-mix(in srgb, var(--danger) 50%, var(--warning))",
    store: 9,
    match: [9, 9],
  },
  {
    rangeLabel: "10",
    headline: "Max effort",
    description:
      "Feels almost impossible to keep going. Completely out of breath, unable to talk. Cannot maintain for more than a very short time.",
    color: "var(--danger)",
    store: 10,
    match: [10, 10],
  },
];

/** The tier a stored 1–10 value falls into, so prior logs highlight correctly. */
function tierForValue(v: number | undefined): Tier | null {
  if (v == null) return null;
  return TIERS.find((t) => v >= t.match[0] && v <= t.match[1]) ?? null;
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
 * six color-coded tier chips plus a None clear, with a live headline +
 * description below. Persistence stays with the caller's `onChoose` (which also
 * closes) and remains a single rpe number; this component is pure UI.
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
    <BottomSheet open={open} onClose={onClose} title="Effort · RPE" subtitle="How hard was that set?">
      <div onPointerLeave={() => setPreview(null)}>
        {/* Six tiers on one row — equal-width chips that shrink to fit. */}
        <div className="flex gap-1">
          {TIERS.map((tier) => {
            const on = selected === tier;
            return (
              <button
                key={tier.store}
                type="button"
                onClick={() => onChoose(tier.store)}
                onPointerEnter={() => setPreview(tier)}
                onFocus={() => setPreview(tier)}
                onBlur={() => setPreview(null)}
                aria-pressed={on}
                aria-label={`RPE ${tier.rangeLabel} — ${tier.headline}`}
                className="flex-1 min-w-0 inline-flex items-center justify-center min-h-12 rounded-[var(--radius-sm)] border text-[15px] font-extrabold tabular-nums"
                style={{
                  color: on ? "var(--text-on-accent)" : tier.color,
                  background: on ? tier.color : `color-mix(in srgb, ${tier.color} 12%, transparent)`,
                  borderColor: on ? tier.color : `color-mix(in srgb, ${tier.color} 35%, transparent)`,
                }}
              >
                {tier.rangeLabel}
              </button>
            );
          })}
        </div>

        {/* Live headline + description of the highlighted tier, or a neutral hint. */}
        <div className="mt-3 min-h-12 flex flex-col items-center justify-center gap-1 text-center">
          {shown ? (
            <>
              <div className="flex items-center justify-center gap-2 text-[15px] font-semibold">
                <span className="tabular-nums" style={{ color: shown.color }}>
                  {shown.rangeLabel}
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span style={{ color: shown.color }}>{shown.headline}</span>
              </div>
              <p className="max-w-[42ch] text-[13px] leading-snug text-[var(--text-muted)]">{shown.description}</p>
            </>
          ) : (
            <span className="text-[15px] font-semibold text-[var(--text-muted)]">Tap to rate effort</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onChoose(undefined)}
          aria-pressed={value == null}
          className={`mt-3 w-full min-h-11 rounded-[var(--radius-md)] border text-[15px] font-semibold ${
            value == null
              ? "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]"
              : "bg-transparent text-[var(--text-muted)] border-[var(--border)]"
          }`}
        >
          None
        </button>
      </div>
    </BottomSheet>
  );
}
