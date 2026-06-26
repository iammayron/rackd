"use client";

import { Nav } from "@/components/Nav";
import { ProgressStats } from "@/features/dashboard/ProgressStats";
import { WeightProgressCard } from "@/features/dashboard/WeightProgressCard";
import { VolumeTrendCard } from "@/features/dashboard/VolumeTrendCard";
import { PersonalRecordsCard } from "@/features/dashboard/PersonalRecordsCard";
import { RecentSessionsCard } from "@/features/dashboard/RecentSessionsCard";

/**
 * Progress tab — the training dashboard: this-week stats, body-weight trend,
 * volume over time, top personal records, and the recent-sessions log (each
 * shareable). Per-exercise analytics now live in the exercise-detail sheet.
 */
export default function HistoryPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 px-5 pt-5 pb-[calc(96px+var(--safe-bottom))]">
        <h1 className="mb-5 text-2xl font-extrabold">Progress</h1>

        <ProgressStats />
        <WeightProgressCard />
        <VolumeTrendCard />
        <PersonalRecordsCard />
        <RecentSessionsCard />
      </main>
      <Nav />
    </div>
  );
}
