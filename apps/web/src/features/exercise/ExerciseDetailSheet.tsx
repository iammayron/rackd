"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query";
import { BottomSheet } from "@/components/BottomSheet";
import { ExerciseDetail } from "./ExerciseDetail";
import { useExerciseDetail } from "./exercise-detail-store";

interface ExerciseRow {
  name: string;
  category: string;
}

const cap = (s: string) =>
  !s ? s : s.toLowerCase() === "fullbody" ? "Full body" : s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The single, app-wide exercise-detail sheet. Mounted once in the app shell;
 * driven by {@link useExerciseDetail}. Tapping a similar exercise swaps the
 * sheet's contents in place (open the new id) rather than stacking sheets.
 */
export function ExerciseDetailSheet() {
  const openId = useExerciseDetail((s) => s.openId);
  const open = useExerciseDetail((s) => s.open);
  const close = useExerciseDetail((s) => s.close);

  const { data: ex } = useQuery({
    queryKey: qk.exercise(openId ?? ""),
    queryFn: () => api<ExerciseRow>(`/api/exercises/${openId}`),
    enabled: Boolean(openId),
  });

  return (
    <BottomSheet
      open={Boolean(openId)}
      onClose={close}
      title={ex?.name}
      subtitle={ex?.category ? cap(ex.category) : undefined}
    >
      {openId && <ExerciseDetail id={openId} onSelectExercise={open} />}
    </BottomSheet>
  );
}
