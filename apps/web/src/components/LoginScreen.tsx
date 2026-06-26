"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { isAuthConfigured } from "@/lib/supabase";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const configured = isAuthConfigured();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const fn = mode === "in" ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
    } else if (mode === "up") {
      setInfo("Account created. If email confirmation is on, check your inbox; otherwise sign in.");
      setMode("in");
    }
  }

  const input =
    "w-full min-h-11 px-3 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-[var(--radius-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]";

  return (
    <main className="min-h-[100dvh] flex flex-col justify-center p-6">
      <h1 className="text-3xl font-bold mb-1">Rackd</h1>
      <p className="text-[var(--text-muted)] mb-6">
        {mode === "in" ? "Sign in to your workouts." : "Create your account."}
      </p>

      {!configured && (
        <div className="mb-4 p-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] border border-[var(--warning)] text-sm text-[var(--warning)]">
          Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          className={input}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className={input}
          type="password"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {info && <p className="text-sm text-[var(--success)]">{info}</p>}

        <button
          type="submit"
          disabled={busy || !configured}
          className="min-h-12 rounded-[var(--radius-sm)] bg-[var(--accent)] text-white font-bold disabled:opacity-60"
        >
          {busy ? "…" : mode === "in" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "in" ? "up" : "in"));
          setError(null);
          setInfo(null);
        }}
        className="mt-4 text-sm text-[var(--accent)] font-semibold"
      >
        {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
