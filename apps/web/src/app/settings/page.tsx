"use client";

import { SettingsForm } from "@/features/settings/SettingsForm";
import { Nav } from "@/components/Nav";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <SettingsForm />
      </main>
      <Nav />
    </div>
  );
}
