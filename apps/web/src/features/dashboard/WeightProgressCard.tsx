"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { Button } from "@rackd/ui";
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
    // A single log can't show a trend — draw a flat line across the midline so
    // the chart still appears (it fills in as more weigh-ins are logged).
    if (values.length === 1) {
      const y = (H / 2).toFixed(1);
      return `M${PAD},${y} L${(W - PAD).toFixed(1)},${y}`;
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = (W - PAD * 2) / (values.length - 1);
    return values
      .map((v, i) => {
        const x = PAD + i * stepX;
        const y = PAD + (1 - (v - min) / span) * (H - PAD * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  if (values.length === 0) return null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="mt-4 h-14 w-full"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Keep digits and a single decimal point so the field stays a weight. */
function maskDecimal(s: string): string {
  const cleaned = s.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
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
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = useMemo(() => {
    if (currentKg === undefined || goalKg === undefined) return undefined;
    return display(Math.abs(currentKg - goalKg));
  }, [currentKg, goalKg, display]);

  const value = Number(text);
  const canSave = Number.isFinite(value) && value > 0;

  function openSheet() {
    // Seed the field from the current weight (display units), else a sane start.
    const seed = currentKg !== undefined ? display(currentKg) : unit === "lb" ? 165 : 75;
    setText(String(Math.round(seed * 10) / 10));
    setOpen(true);
  }

  // Focus once the sheet is open so the number keyboard comes up with the field.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const id = requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) el.setSelectionRange(0, el.value.length);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  async function save() {
    if (!canSave || saving) return;
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
          <div className="mt-3 flex items-end gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Current
              </p>
              <p className="mt-1 text-3xl font-extrabold leading-none tabular-nums">
                {currentKg !== undefined ? fmt(currentKg) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Goal
              </p>
              <p className="mt-1 text-3xl font-extrabold leading-none tabular-nums">
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
          <div className="flex min-w-0 items-center justify-center gap-1 px-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
            <input
              ref={inputRef}
              inputMode="decimal"
              enterKeyHint="done"
              value={text}
              onChange={(e) => setText(maskDecimal(e.target.value))}
              onFocus={(e) => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void save();
                }
              }}
              aria-label={`Weight (${unit})`}
              className="min-w-0 w-full text-center bg-transparent text-[var(--text)] text-4xl font-bold tabular-nums py-3 focus:outline-none"
            />
            <span className="shrink-0 text-lg text-[var(--text-muted)]">{unit}</span>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={save}
            disabled={saving || !canSave}
            className="mt-7"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </BottomSheet>
    </section>
  );
}
