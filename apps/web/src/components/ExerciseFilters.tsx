"use client";

import { useMemo } from "react";

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

function Chip({
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
      className={`shrink-0 min-h-9 px-3 rounded-full border text-sm font-semibold whitespace-nowrap ${
        active
          ? "bg-[var(--accent-wash)] text-[var(--accent)] border-[var(--accent)]"
          : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Muscle + equipment filter chips, derived from whatever exercises are passed
 * in. Controlled: the parent owns the `muscle`/`equipment` selection. Shared by
 * the Add and Replace pickers (same chips as the standalone library page).
 */
export function ExerciseFilters({
  exercises,
  muscle,
  equipment,
  onMuscle,
  onEquipment,
}: {
  exercises: { primaryMuscle: string; equipment: string }[];
  muscle: string | null;
  equipment: string | null;
  onMuscle: (m: string | null) => void;
  onEquipment: (e: string | null) => void;
}) {
  const muscles = useMemo(
    () => [...new Set(exercises.map((e) => e.primaryMuscle).filter(Boolean))].sort(),
    [exercises],
  );
  const equipments = useMemo(
    () => [...new Set(exercises.map((e) => e.equipment).filter(Boolean))].sort(),
    [exercises],
  );

  return (
    <>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!muscle} onClick={() => onMuscle(null)}>
          All muscles
        </Chip>
        {muscles.map((m) => (
          <Chip key={m} active={muscle === m} onClick={() => onMuscle(m)}>
            {cap(m)}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!equipment} onClick={() => onEquipment(null)}>
          All equipment
        </Chip>
        {equipments.map((eq) => (
          <Chip key={eq} active={equipment === eq} onClick={() => onEquipment(eq)}>
            {cap(eq)}
          </Chip>
        ))}
      </div>
    </>
  );
}
