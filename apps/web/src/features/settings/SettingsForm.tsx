"use client";

import { useEffect, useRef, useState } from "react";
import type { TrainingGoal } from "@rackd/core";
import { getProfile, updateProfile, type ProfilePatch } from "@rackd/db";
import { mmss } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId, useAuth } from "@/lib/auth";
import { useUnit, useUnitStore } from "@/lib/units-store";
import { useTheme } from "@/lib/theme";
import { AdvancedSelect } from "@/components/AdvancedSelect";
import { Avatar } from "@/components/Avatar";
import { uploadProfilePhoto, PHOTO_ACCEPT } from "@/lib/upload-photo";

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

/** Parse rest as plain seconds ("90") or mm:ss ("1:30"); seconds ≥ 0 required. */
function parseRest(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  if (t.includes(":")) {
    const parts = t.split(":");
    if (parts.length !== 2) return undefined;
    const m = Number(parts[0]);
    const sec = Number(parts[1]);
    if (!Number.isInteger(m) || !Number.isInteger(sec) || m < 0 || sec < 0 || sec > 59) {
      return undefined;
    }
    return m * 60 + sec;
  }
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

/** Parse a positive integer (≥ 1); returns undefined when blank/invalid. */
function posInt(s: string): number | undefined {
  const n = Number(s.trim());
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

export function SettingsForm() {
  const { unit, display, toKg } = useUnit();
  const setUnit = useUnitStore((s) => s.setUnit);
  const { user, signOut } = useAuth();
  const { theme, setTheme: setThemeChoice } = useTheme();
  const metric = unit === "kg";
  const heightUnit = metric ? "cm" : "in";

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [height, setHeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [defaultRest, setDefaultRest] = useState("");
  const [defaultSets, setDefaultSets] = useState("");
  const [defaultReps, setDefaultReps] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Load (and create if missing) the profile once, into display units.
  useEffect(() => {
    let cancelled = false;
    getProfile(getClient(), getCurrentUserId()).then((p) => {
      if (cancelled) return;
      // Profile is the durable home for the measurement system — sync the
      // runtime kg/lb toggle to it so the choice survives across devices.
      const pref = p.unitPreference === "imperial" ? "lb" : "kg";
      if (pref !== unit) setUnit(pref);
      setName(p.displayName ?? "");
      setPhotoUrl(p.photoUrl ?? "");
      setHeight(p.heightCm != null ? String(fromCm(p.heightCm, metric)) : "");
      setCurrentWeight(p.currentWeightKg != null ? String(display(p.currentWeightKg)) : "");
      setGoalWeight(p.goalWeightKg != null ? String(display(p.goalWeightKg)) : "");
      setGoal(p.trainingGoal ?? "");
      setDefaultRest(mmss(p.defaultRestSec * 1000));
      setDefaultSets(String(p.defaultSets));
      setDefaultReps(String(p.defaultReps));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Re-read display values when the unit toggle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  /**
   * Upload a chosen image to MinIO and persist its URL immediately. Isolated
   * from `save()` — a failed upload only sets `photoError` and never blocks
   * saving the rest of the settings.
   */
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(file);
      setPhotoUrl(url);
      // Persist just the photo so it survives even if the user never hits Save.
      await updateProfile(getClient(), getCurrentUserId(), { photoUrl: url });
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setPhotoError(null);
    setPhotoUrl("");
    await updateProfile(getClient(), getCurrentUserId(), { photoUrl: "" });
  }

  /** Flip the measurement system: re-displays weights/heights app-wide live. */
  function chooseSystem(nextMetric: boolean) {
    setUnit(nextMetric ? "kg" : "lb");
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    const rest = parseRest(defaultRest);
    const sets = posInt(defaultSets);
    const reps = posInt(defaultReps);
    if (rest === undefined) {
      setError("Default rest must be seconds (≥ 0) or mm:ss.");
      return;
    }
    if (sets === undefined || reps === undefined) {
      setError("Default sets and reps must be positive whole numbers.");
      return;
    }
    setError(null);
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
      unitPreference: metric ? "metric" : "imperial",
      defaultRestSec: rest,
      defaultSets: sets,
      defaultReps: reps,
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
      <Field label="Measurement system">
        <div className="inline-flex rounded-lg border border-[var(--border)] p-1 bg-[var(--surface-2)]">
          <Segment active={metric} onClick={() => chooseSystem(true)}>
            Metric (kg/cm)
          </Segment>
          <Segment active={!metric} onClick={() => chooseSystem(false)}>
            Imperial (lb/in)
          </Segment>
        </div>
      </Field>

      <Field label="Appearance">
        <div className="inline-flex rounded-lg border border-[var(--border)] p-1 bg-[var(--surface-2)]">
          <Segment active={theme === "light"} onClick={() => setThemeChoice("light")}>
            Light
          </Segment>
          <Segment active={theme === "dark"} onClick={() => setThemeChoice("dark")}>
            Dark
          </Segment>
          <Segment active={theme === "system"} onClick={() => setThemeChoice("system")}>
            System
          </Segment>
        </div>
      </Field>

      <Field label="Name">
        <Input value={name} onChange={setName} placeholder="Your name" />
      </Field>

      <Field label="Profile photo">
        <div className="flex items-center gap-4">
          <Avatar src={photoUrl || null} name={name} size={64} />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={PHOTO_ACCEPT}
                onChange={onPickPhoto}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="min-h-10 px-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold disabled:opacity-50"
              >
                {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
              </button>
              {photoUrl && !uploading && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="min-h-10 px-3 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">JPEG, PNG, WebP or GIF · up to 5 MB</p>
          </div>
        </div>
        {photoError && (
          <p className="mt-2 text-sm text-[var(--danger,#dc2626)]">{photoError}</p>
        )}
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

      <Field label="Default rest timer (seconds or mm:ss)">
        <Input value={defaultRest} onChange={setDefaultRest} placeholder="90 or 1:30" />
      </Field>

      <Field label="Default sets">
        <Input value={defaultSets} onChange={setDefaultSets} placeholder="3" inputMode="numeric" />
      </Field>

      <Field label="Default reps">
        <Input value={defaultReps} onChange={setDefaultReps} placeholder="10" inputMode="numeric" />
      </Field>

      {error && <p className="text-sm text-[var(--danger,#dc2626)]">{error}</p>}

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

      <div className="pt-6 mt-2 border-t border-[var(--border)]">
        <span className="block text-sm text-[var(--text-muted)] mb-1.5">Account</span>
        <div className="flex items-center gap-3">
          <span className="flex-1 text-sm text-[var(--text-muted)] truncate">{user?.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="min-h-10 px-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold"
          >
            Sign out
          </button>
        </div>
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

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 px-3 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
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
  inputMode?: "decimal" | "url" | "numeric";
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
