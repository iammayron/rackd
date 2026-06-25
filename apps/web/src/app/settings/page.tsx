"use client";

import { useRouter } from "next/navigation";
import { SettingsForm } from "@/features/settings/SettingsForm";
import { BackButton } from "@/components/BackButton";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-[var(--safe-top)] z-10 flex items-center gap-1 border-b border-[var(--border)] bg-[var(--bg)] px-2 py-2">
        <BackButton onClick={() => router.back()} />
        <h1 className="text-lg font-bold text-[var(--text)]">Settings</h1>
      </header>
      <main className="flex-1 p-6">
        <SettingsForm />
      </main>
    </div>
  );
}
