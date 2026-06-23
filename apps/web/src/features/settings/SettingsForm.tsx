"use client";

import { useEffect, useState } from "react";
import type { TrainingGoal } from "@myfit/core";
import { getProfile, updateProfile, type ProfilePatch } from "@myfit/db";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId } from "@/lib/auth";
import { useUnit } from "@/lib/units-store";
import { AdvancedSelect } from "@/components/AdvancedSelect";

const GOAL_OPTIONS: { value: TrainingGoal; label: string }[] = [
  { value: "weight_loss", label: "Weight loss" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "strength", label: "Strength" },
  { value: "muscle_gain", label: "Muscle gain" },
];

const CM_PER_INCH = 2.54;

/** Height is stored canonical (cm); display in cm (metric) or inches (imperial). */
function fromCm(cm: number, metric: boolean): number {
  return Number((metric ? cm : cm / CM_PER_INCH).toFixed(1));
}
function toCm(value: number, metric: boolean): number {
  return metric ? value : value * CM_PER_INCH;
}

/** Parse a possibly-empty input; returns undefined when blank/invalid. */
function num(s: string): number | undefined {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

export function SettingsForm() {
  const { unit, display, toKg } = useUnit();
  const metric = unit === "kg";
  const heightUnit = metric ? "cm" : "in";

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [height, setHeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load (and create if missing) the profile once, into display units.
  useEffect(() => {
    let cancelled = false;
    getProfile(getClient(), getCurrentUserId()).then((p) => {
      if (cancelled) return;
      setName(p.displayName ?? "");
      setPhotoUrl(p.photoUrl ?? "");
      setHeight(p.heightCm != null ? String(fromCm(p.heightCm, metric)) : "");
      setCurrentWeight(p.currentWeightKg != null ? String(display(p.currentWeightKg)) : "");
      setGoalWeight(p.goalWeightKg != null ? String(display(p.goalWeightKg)) : "");
      setGoal(p.trainingGoal ?? "");
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Re-read display values when the unit toggle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    const h = num(height);
    const cw = num(currentWeight);
    const gw = num(goalWeight);
    const patch: ProfilePatch = {
      displayName: name.trim(),
      photoUrl: photoUrl.trim(),
      heightCm: h != null ? toCm(h, metric) : undefined,
      currentWeightKg: cw != null ? toKg(cw) : undefined,
      goalWeightKg: gw != null ? toKg(gw) : undefined,
      trainingGoal: goal ? (goal as TrainingGoal) : undefined,
    };
    await updateProfile(getClient(), getCurrentUserId(), patch);
    setSaving(false);
    setSaved(true);
  }

  if (!loaded) {
    return <p className="text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="Your name" />
      </Field>

      <Field label="Photo URL">
        <Input value={photoUrl} onChange={setPhotoUrl} placeholder="https://…" inputMode="url" />
      </Field>

      <Field label={`Height (${heightUnit})`}>
        <Input value={height} onChange={setHeight} placeholder={heightUnit} inputMode="decimal" />
      </Field>

      <Field label={`Current weight (${unit})`}>
        <Input value={currentWeight} onChange={setCurrentWeight} placeholder={unit} inputMode="decimal" />
      </Field>

      <Field label={`Goal weight (${unit})`}>
        <Input value={goalWeight} onChange={setGoalWeight} placeholder={unit} inputMode="decimal" />
      </Field>

      <Field label="Training goal">
        <AdvancedSelect
          value={goal}
          onChange={setGoal}
          placeholder="Choose a goal…"
          options={GOAL_OPTIONS}
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-11 px-5 rounded-lg bg-[var(--accent)] text-white font-bold hover:bg-[var(--accent-press)] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-[var(--text-muted)]">Saved ✓</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-[var(--text-muted)] mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "url";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="block w-full min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
    />
  );
}
