"use client";

/**
 * Provider-agnostic identity. Today: a persisted anonymous id in localStorage
 * (no login, fully local). Later: swap the body of getCurrentUserId() to return
 * the Supabase auth user id — every call site already routes through here, so
 * cloud sync + multi-user needs no other change.
 *
 * Data is owned by ownerId; when real auth lands, existing anon-owned rows can
 * be claimed by reassigning ownerId to the authenticated user id on first login.
 */
const KEY = "fitnow.uid";

export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "local";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = `anon_${crypto.randomUUID()}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
