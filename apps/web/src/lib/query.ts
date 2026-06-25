import { QueryClient } from "@tanstack/react-query";
import {
  persistQueryClient,
  type Persister,
} from "@tanstack/query-persist-client-core";
import { get, set, del } from "idb-keyval";

/**
 * Single React Query client for the app. `staleTime` keeps reads from refetching
 * on every mount (Triplit gave us live data for free; we trade that for explicit
 * invalidation in mutations). The cache is persisted to IndexedDB so reads work
 * offline.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      gcTime: 1000 * 60 * 60 * 24, // keep cached data a day for offline reads
    },
  },
});

const CACHE_KEY = "rackd-query-cache";

const idbPersister: Persister = {
  persistClient: (client) => set(CACHE_KEY, client),
  restoreClient: () => get(CACHE_KEY),
  removeClient: () => del(CACHE_KEY),
};

let started = false;
/** Begin persisting the query cache to IndexedDB (client-only, idempotent). */
export function startQueryPersistence(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  persistQueryClient({
    queryClient,
    persister: idbPersister,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

/**
 * Central query-key registry so reads and mutation invalidations agree on keys.
 * Mirrors the API route paths.
 */
export const qk = {
  exercises: ["exercises"] as const,
  exercise: (id: string) => ["exercises", id] as const,
  exerciseStats: (id: string) => ["exercises", id, "stats"] as const,
  lastPerformance: (id: string) => ["exercises", id, "last-performance"] as const,
  routines: ["routines"] as const,
  routine: (id: string) => ["routines", id] as const,
  sessions: ["sessions"] as const,
  activeSession: ["sessions", "active"] as const,
  session: (id: string) => ["sessions", id] as const,
  saveBackContext: (id: string) => ["sessions", id, "save-back-context"] as const,
  personalRecords: ["personal-records"] as const,
  personalRecordsForExercise: (id: string) => ["personal-records", "exercise", id] as const,
  profile: ["profile"] as const,
  bodyWeight: ["body-weight"] as const,
  programs: ["programs"] as const,
  program: (id: string) => ["programs", id] as const,
  sharedRoutines: ["shared-routines"] as const,
  weeklyVolume: ["stats", "weekly-volume"] as const,
  pushSubscriptions: ["push-subscriptions"] as const,
};
