"use client";

import { useMemo, useState } from "react";
import { logBodyWeight } from "@rackd/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useQuery } from "@/lib/use-query";
import { useUnit } from "@/lib/units-store";

interface WeightLogRow {
  id: string;
  weightKg: number;
  loggedAt: number;
}

interface ProfileRow {
  id: string;
  currentWeightKg?: number;
  goalWeightKg?: number;
}

/** Tiny inline sparkline of the weight trend. Pure SVG, no chart lib. */
function Sparkline({ values }: { values: number[] }) {
  const W = 260;
  const H = 56;
  const PAD = 4;
  const path = useMemo(() => {
    if (values.length === 0) return "";
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0;
    return values
      .map((v, i) => {
        const x = PAD + i * stepX;
        const y = PAD + (1 - (v - min) / span) * (H - PAD * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  if (values.length < 2) return null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-4 h-14 w-full"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WeightProgressCard() {
  const { unit, display, toKg, fmt } = useUnit();

  const { results: logs } = useQuery<WeightLogRow>((c) =>
    c.query("bodyWeightLogs").Order("loggedAt", "ASC"),
  );
  const { results: profiles } = useQuery<ProfileRow>((c) => c.query("userProfile"));
  const profile = profiles[0];

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : undefined;
  const currentKg = profile?.currentWeightKg ?? latestLog?.weightKg;
  const goalKg = profile?.goalWeightKg;

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const remaining = useMemo(() => {
    if (currentKg === undefined || goalKg === undefined) return undefined;
    return display(Math.abs(currentKg - goalKg));
  }, [currentKg, goalKg, display]);

  async function save() {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || saving) return;
    setSaving(true);
    try {
      await logBodyWeight(getClient(), {
        ownerId: getCurrentUserId(),
        weightKg: toKg(n),
        loggedAt: Date.now(),
      });
      setValue("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasData = currentKg !== undefined || logs.length > 0;

  return (
    <section className="mb-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Weight progress
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-[var(--accent)]"
        >
          {open ? "Cancel" : "Log weight"}
        </button>
      </div>

      {hasData ? (
        <>
          <div className="mt-2 flex items-end gap-6">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Current</p>
              <p className="text-3xl font-extrabold leading-tight tabular-nums">
                {currentKg !== undefined ? fmt(currentKg) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">Goal</p>
              <p className="text-2xl font-bold leading-tight text-[var(--text-muted)] tabular-nums">
                {goalKg !== undefined ? fmt(goalKg) : "—"}
              </p>
            </div>
          </div>
          {remaining !== undefined && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {remaining > 0 ? `${remaining} ${unit} to go` : "Goal reached 🎉"}
            </p>
          )}
          <Sparkline values={logs.map((l) => display(l.weightKg))} />
        </>
      ) : (
        <p className="mt-2 text-[var(--text-muted)]">
          No weight logged yet. Log your weight to track progress toward your goal.
        </p>
      )}

      {open && (
        <div className="mt-4 flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder={`Weight (${unit})`}
            className="min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 text-base text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || value.trim() === ""}
            className="min-h-11 rounded-lg bg-[var(--accent)] px-5 font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}
