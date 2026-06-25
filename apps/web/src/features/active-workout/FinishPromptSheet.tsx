"use client";

import { Button } from "@rackd/ui";
import { BottomSheet } from "@/components/BottomSheet";

/**
 * Offered once every set in the session is logged: a slide-up over a blocking
 * backdrop asking whether to finish now or keep the session open to add more.
 * "Finish" hands off to the page's existing finish flow (PRs → save-back →
 * summary); "Add more" just dismisses. Tapping the backdrop = Add more.
 */
export function FinishPromptSheet({
  open,
  onFinish,
  onKeepGoing,
}: {
  open: boolean;
  onFinish: () => void;
  onKeepGoing: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onKeepGoing}
      title="Workout complete?"
      subtitle="Every set is logged"
    >
      <div className="flex flex-col gap-3 pt-1 pb-1">
        <p className="text-sm text-[var(--text-muted)] leading-snug">
          You&apos;ve logged every set. Finish up now, or keep the session open
          to add more exercises.
        </p>
        <Button variant="primary" size="lg" fullWidth onClick={onFinish}>
          Finish workout
        </Button>
        <Button variant="ghost" fullWidth onClick={onKeepGoing}>
          Add more exercises
        </Button>
      </div>
    </BottomSheet>
  );
}
