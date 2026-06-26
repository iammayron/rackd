"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { useUnit } from "@/lib/units-store";
import { useAuth } from "@/lib/auth";
import { BottomSheet } from "@/components/BottomSheet";

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

/** A friendly first name for the sheet subtitle ("Today · Sam"), best-effort. */
function firstName(meta: Record<string, unknown> | undefined, email: string | undefined): string {
  const full = typeof meta?.full_name === "string" ? meta.full_name : undefined;
  const name = full ?? (typeof meta?.name === "string" ? (meta.name as string) : undefined);
  if (name) return name.trim().split(/\s+/)[0]!;
  if (email) return email.split("@")[0]!;
  return "";
}

export function WeightProgressCard() {
  const { unit, display, toKg, fmt } = useUnit();
  const { user } = useAuth();

  const { data: logs = [] } = useQuery({
    queryKey: qk.bodyWeight,
    queryFn: () => api<WeightLogRow[]>("/api/body-weight"),
  });
  const { data: profile } = useQuery({
    queryKey: qk.profile,
    queryFn: () => api<ProfileRow>("/api/profile"),
  });

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : undefined;
  const currentKg = profile?.currentWeightKg ?? latestLog?.weightKg;
  const goalKg = profile?.goalWeightKg;

  // The sheet edits in display units (kg or lb); convert to kg only on save.
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);

  const remaining = useMemo(() => {
    if (currentKg === undefined || goalKg === undefined) return undefined;
    return display(Math.abs(currentKg - goalKg));
  }, [currentKg, goalKg, display]);

  function openSheet() {
    // Seed the stepper from the current weight (display units), else a sane start.
    const seed = currentKg !== undefined ? display(currentKg) : unit === "lb" ? 165 : 75;
    setValue(Math.round(seed * 10) / 10);
    setOpen(true);
  }

  function bump(delta: number) {
    setValue((v) => Math.max(0, Math.round((v + delta) * 10) / 10));
  }

  async function save() {
    if (!Number.isFinite(value) || value <= 0 || saving) return;
    setSaving(true);
    try {
      await api("/api/body-weight", {
        method: "POST",
        body: JSON.stringify({ weightKg: toKg(value), loggedAt: Date.now() }),
      });
      queryClient.invalidateQueries({ queryKey: qk.bodyWeight });
      queryClient.invalidateQueries({ queryKey: qk.profile });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const hasData = currentKg !== undefined || logs.length > 0;
  const name = firstName(user?.user_metadata, user?.email ?? undefined);

  return (
    <section className="mb-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Weight progress
        </p>
        <button
          type="button"
          onClick={openSheet}
          className="text-sm font-semibold text-[var(--accent)]"
        >
          Log weight
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

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Log weight"
        subtitle={name ? `Today · ${name}` : "Today"}
      >
        <div className="px-1 pt-2">
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              aria-label="Decrease"
              onClick={() => bump(-0.1)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-2xl font-bold text-[var(--text)] active:scale-95"
            >
              −
            </button>
            <div className="min-w-[7.5rem] text-center">
              <span className="text-5xl font-extrabold tabular-nums">
                {value.toFixed(1)}
              </span>
              <span className="ml-1.5 text-xl font-bold text-[var(--text-muted)]">{unit}</span>
            </div>
            <button
              type="button"
              aria-label="Increase"
              onClick={() => bump(0.1)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-2xl font-bold text-[var(--text)] active:scale-95"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving || value <= 0}
            className="mt-7 min-h-[52px] w-full rounded-[var(--radius-lg)] bg-[var(--accent)] text-lg font-bold text-[var(--text-on-accent)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
