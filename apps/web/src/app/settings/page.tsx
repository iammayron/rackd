"use client";

import { useRouter } from "next/navigation";
import { SettingsForm } from "@/features/settings/SettingsForm";

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-[var(--border)] bg-[var(--bg)] px-2 py-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-[var(--text)]">Settings</h1>
      </header>
      <main className="flex-1 p-6">
        <SettingsForm />
      </main>
    </div>
  );
}
