"use client";

import { useEffect, useRef, useState } from "react";
import { fromKg, toKg as coreToKg, type TrainingGoal, type Unit } from "@rackd/core";
import { getProfile, updateProfile, type ProfilePatch } from "@rackd/db";
import { mmss, Card, Button, SegmentedControl, Input } from "@rackd/ui";
import { getClient } from "@/lib/triplit";
import { getCurrentUserId, useAuth } from "@/lib/auth";
import { useUnit, useUnitStore } from "@/lib/units-store";
import { useTheme, type Theme } from "@/lib/theme";
import { Avatar } from "@/components/Avatar";
import { uploadProfilePhoto, PHOTO_ACCEPT } from "@/lib/upload-photo";
import { useToast } from "@/components/toast/ToastProvider";

const GOAL_OPTIONS: { value: TrainingGoal; label: string }[] = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "get_stronger", label: "Get stronger" },
  { value: "lose_fat", label: "Lose fat" },
  { value: "endurance", label: "Endurance" },
  { value: "general_fitness", label: "General fitness" },
];

const CM_PER_INCH = 2.54;

/** Height is stored canonical (cm). Metric displays cm; imperial splits to ft/in. */
function cmToDisplay(cm: number): string {
  return String(Number(cm.toFixed(1)));
}

/** Split canonical cm into whole feet + inches (inches rounded, carrying 12 → ft). */
function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  let ft = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ft, inches };
}

/** Compose canonical cm from whole feet + inches. */
function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * CM_PER_INCH;
}

/** Reconvert a displayed weight string when the unit toggles, keeping unsaved edits. */
function reconvertWeight(s: string, from: Unit, to: Unit): string {
  if (from === to) return s;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return String(Number(fromKg(coreToKg(n, from), to).toFixed(1)));
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

/**
 * Mask rest-timer input toward m:ss. Keeps only digits (max 4) and inserts the
 * colon once there are ≥ 3, so typing "130" reads "1:30". ≤ 2 digits stay bare
 * (plain seconds), which parseRest still accepts.
 */
function maskRest(s: string): string {
  const digits = s.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

/** Keep digits only (max 3) — for the bare-integer Sets/Reps and ft/in fields. */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "").slice(0, 3);
}

/** Keep digits + a single decimal point — for the weight / metric-height fields. */
function maskDecimal(s: string): string {
  const cleaned = s.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}

/** Parse a positive integer (≥ 1); returns undefined when blank/invalid. */
function posInt(s: string): number | undefined {
  const n = Number(s.trim());
  return Number.isInteger(n) && n >= 1 ? n : undefined;
}

export function SettingsForm() {
  const { unit, display, toKg } = useUnit();
  const setUnit = useUnitStore((s) => s.setUnit);
  const { signOut } = useAuth();
  const { theme, setTheme: setThemeChoice } = useTheme();
  const toast = useToast();
  const metric = unit === "kg";

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [height, setHeight] = useState(""); // canonical cm string (metric input)
  const [heightFt, setHeightFt] = useState(""); // imperial feet
  const [heightIn, setHeightIn] = useState(""); // imperial inches
  const [currentWeight, setCurrentWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goal, setGoal] = useState<string>("");
  const [defaultRest, setDefaultRest] = useState("");
  const [defaultSets, setDefaultSets] = useState("");
  const [defaultReps, setDefaultReps] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // Tracks the unit across renders so a toggle can reconvert the numeric fields
  // in place (below) instead of refetching — refetching wiped unsaved edits.
  const prevUnit = useRef(unit);

  // Load (and create if missing) the profile once, into display units. Runs a
  // SINGLE time: toggling the unit must never refetch (that clobbered unsaved
  // edits like the name). The reconvert effect re-displays the numbers instead.
  useEffect(() => {
    let cancelled = false;
    getProfile(getClient(), getCurrentUserId()).then((p) => {
      if (cancelled) return;
      // Profile is the durable home for the measurement system — sync the
      // runtime kg/lb toggle to it so the choice survives across devices. If
      // this flips the unit, the reconvert effect re-displays the numbers.
      const pref = p.unitPreference === "imperial" ? "lb" : "kg";
      if (pref !== unit) setUnit(pref);
      setName(p.displayName ?? "");
      setPhotoUrl(p.photoUrl ?? "");
      if (p.heightCm != null) {
        if (metric) {
          setHeight(cmToDisplay(p.heightCm));
        } else {
          const { ft, inches } = cmToFtIn(p.heightCm);
          setHeightFt(String(ft));
          setHeightIn(String(inches));
        }
      }
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
    // Load once on mount; never re-run on unit change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-display the unit-dependent fields when the toggle flips, converting the
  // current (possibly unsaved) input values in place — no DB read, so edits to
  // name/goal/rest and any half-typed numbers all survive the switch.
  useEffect(() => {
    const from = prevUnit.current;
    if (from === unit) return;
    prevUnit.current = unit;
    if (from === "kg" && unit === "lb") {
      // metric → imperial: split the cm field into ft/in.
      const cm = parseFloat(height);
      if (Number.isFinite(cm)) {
        const { ft, inches } = cmToFtIn(cm);
        setHeightFt(String(ft));
        setHeightIn(String(inches));
      } else {
        setHeightFt("");
        setHeightIn("");
      }
      setHeight("");
    } else if (from === "lb" && unit === "kg") {
      // imperial → metric: compose ft/in back into cm.
      if (heightFt.trim() !== "" || heightIn.trim() !== "") {
        const cm = ftInToCm(parseFloat(heightFt) || 0, parseFloat(heightIn) || 0);
        setHeight(cmToDisplay(cm));
      } else {
        setHeight("");
      }
      setHeightFt("");
      setHeightIn("");
    }
    setCurrentWeight((s) => reconvertWeight(s, from, unit));
    setGoalWeight((s) => reconvertWeight(s, from, unit));
    // Reads height/ft/in directly; effect only fires on unit change so they're current.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  /**
   * Upload a chosen image to MinIO and persist its URL immediately. Isolated
   * from `save()` — a failed upload only fires an error toast and never blocks
   * saving the rest of the settings.
   */
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProfilePhoto(file);
      setPhotoUrl(url);
      // Persist just the photo so it survives even if the user never hits Save.
      await updateProfile(getClient(), getCurrentUserId(), { photoUrl: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Photo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setPhotoUrl("");
    await updateProfile(getClient(), getCurrentUserId(), { photoUrl: "" });
  }

  /** Flip the measurement system: re-displays weights/heights app-wide live. */
  function chooseSystem(nextMetric: boolean) {
    setUnit(nextMetric ? "kg" : "lb");
  }

  async function save() {
    if (saving) return;
    const rest = parseRest(defaultRest);
    const sets = posInt(defaultSets);
    const reps = posInt(defaultReps);
    if (rest === undefined) {
      toast.error("Default rest must be seconds (≥ 0) or mm:ss.");
      return;
    }
    if (sets === undefined || reps === undefined) {
      toast.error("Default sets and reps must be positive whole numbers.");
      return;
    }
    setSaving(true);
    const cw = num(currentWeight);
    const gw = num(goalWeight);
    let heightCm: number | undefined;
    if (metric) {
      const h = num(height);
      heightCm = h != null ? h : undefined;
    } else {
      const ft = num(heightFt);
      const inches = num(heightIn);
      heightCm = ft != null || inches != null ? ftInToCm(ft ?? 0, inches ?? 0) : undefined;
    }
    const patch: ProfilePatch = {
      displayName: name.trim(),
      photoUrl: photoUrl.trim(),
      heightCm,
      currentWeightKg: cw != null ? toKg(cw) : undefined,
      goalWeightKg: gw != null ? toKg(gw) : undefined,
      trainingGoal: goal ? (goal as TrainingGoal) : undefined,
      unitPreference: metric ? "metric" : "imperial",
      defaultRestSec: rest,
      defaultSets: sets,
      defaultReps: reps,
    };
    try {
      await updateProfile(getClient(), getCurrentUserId(), patch);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className="text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <Avatar src={photoUrl || null} name={name} size={64} />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="truncate text-lg font-bold text-[var(--text)]">
                {name || "Your name"}
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                JPEG, PNG or WebP · up to 5 MB
              </p>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={onPickPhoto}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : photoUrl ? "Change photo" : "Upload photo"}
              </Button>
              {photoUrl && !uploading && (
                <Button variant="ghost" size="sm" onClick={removePhoto}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <Field label="Appearance">
            <SegmentedControl
              value={theme}
              onChange={(v) => setThemeChoice(v as Theme)}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </Field>

          <Field label="Measurement system">
            <SegmentedControl
              value={unit}
              onChange={(v) => chooseSystem(v === "kg")}
              options={[
                { value: "kg", label: "Metric (kg/cm)" },
                { value: "lb", label: "Imperial (lb/in)" },
              ]}
            />
          </Field>

          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Current weight (${unit})`}>
              <Input
                value={currentWeight}
                onChange={(e) => setCurrentWeight(maskDecimal(e.target.value))}
                placeholder={unit}
                inputMode="decimal"
                suffix={unit}
              />
            </Field>
            <Field label={`Goal weight (${unit})`}>
              <Input
                value={goalWeight}
                onChange={(e) => setGoalWeight(maskDecimal(e.target.value))}
                placeholder={unit}
                inputMode="decimal"
                suffix={unit}
              />
            </Field>
          </div>

          {metric ? (
            <Field label="Height (cm)">
              <Input
                value={height}
                onChange={(e) => setHeight(maskDecimal(e.target.value))}
                placeholder="cm"
                inputMode="decimal"
                suffix="cm"
              />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (ft)">
                <Input
                  value={heightFt}
                  onChange={(e) => setHeightFt(digitsOnly(e.target.value))}
                  placeholder="ft"
                  inputMode="numeric"
                  suffix="ft"
                />
              </Field>
              <Field label="Height (in)">
                <Input
                  value={heightIn}
                  onChange={(e) => setHeightIn(digitsOnly(e.target.value))}
                  placeholder="in"
                  inputMode="numeric"
                  suffix="in"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <Field label="Training goal">
          <div className="flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((o) => (
              <GoalPill
                key={o.value}
                active={goal === o.value}
                onClick={() => setGoal(goal === o.value ? "" : o.value)}
              >
                {o.label}
              </GoalPill>
            ))}
          </div>
        </Field>
      </Card>

      <Card>
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
          Workout defaults
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Rest timer">
            <Input
              value={defaultRest}
              onChange={(e) => setDefaultRest(maskRest(e.target.value))}
              placeholder="1:30"
              inputMode="numeric"
              align="center"
            />
          </Field>
          <Field label="Sets">
            <Input
              value={defaultSets}
              onChange={(e) => setDefaultSets(digitsOnly(e.target.value))}
              placeholder="3"
              inputMode="numeric"
              align="center"
            />
          </Field>
          <Field label="Reps">
            <Input
              value={defaultReps}
              onChange={(e) => setDefaultReps(digitsOnly(e.target.value))}
              placeholder="10"
              inputMode="numeric"
              align="center"
            />
          </Field>
        </div>
      </Card>

      <div className="pt-1">
        <Button variant="primary" size="lg" fullWidth onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <Button variant="ghost" fullWidth onClick={() => signOut()}>
        Sign out
      </Button>

      <p className="pt-2 text-center text-xs text-[var(--text-muted)]">
        Rackd · local-first · v1.0
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function GoalPill({
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
      className={`min-h-9 rounded-full px-4 text-sm font-bold transition-colors ${
        active
          ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
          : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
