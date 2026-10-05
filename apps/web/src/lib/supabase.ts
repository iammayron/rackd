"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (auth only). Points at the configured Supabase.
 * Persists the session in localStorage and auto-refreshes tokens.
 * Falls back to a dummy URL in demo/unconfigured mode to prevent initialization crashes.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://demo.supabase.co";
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "demo-anon-key";
    client = createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("demo.supabase.co"),
  );
}
