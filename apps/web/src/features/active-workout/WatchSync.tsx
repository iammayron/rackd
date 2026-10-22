"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { getSupabase } from "@/lib/supabase";
import { useUnitStore } from "@/lib/units-store";
import { buildWatchPayload } from "./watch-payload";
import { canMirrorToWatch, watchPlugin, type WatchCap, type WatchPlugin } from "./watch-bridge";
import { useTimerStore } from "./timer-store";

interface WatchSession {
  exercises: {
    restSec: number;
    supersetGroup?: number | null;
    exercise: { name: string } | null;
    sets?: { id: string; order: number; weight: number; reps: number; completed: boolean }[];
  }[];
}

let cached: WatchPlugin | null = null;

function wearPlugin(): WatchPlugin | null {
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  const cap = (window as Window & { Capacitor?: WatchCap }).Capacitor;
  if (!canMirrorToWatch(cap) || !cap) return null;
  cached = watchPlugin(cap);
  return cached;
}

/**
 * Mirrors the open workout to a paired Galaxy Watch (Wear OS) and applies
 * log / skip / +30s tapped there. No-ops in the browser and the installed PWA.
 */
export function WatchSync() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(wearPlugin() != null);
  }, []);
  if (!on) return null;
  return <WatchSyncLive />;
}

function WatchSyncLive() {
  const plugin = wearPlugin();
  const activeQuery = useQuery({
    queryKey: qk.activeSession,
    queryFn: () => api<{ id: string } | null>("/api/sessions/active"),
  });
  const sessionId = activeQuery.data?.id;
  const activeKnown = activeQuery.isFetched;
  const { data: session } = useQuery({
    queryKey: qk.session(sessionId ?? "none"),
    enabled: Boolean(sessionId),
    queryFn: () => api<WatchSession>(`/api/sessions/${sessionId}`),
  });
  const unit = useUnitStore((s) => s.unit);
  const restEndAt = useTimerStore((s) =>
    s.state.status === "running" ? (s.state.endAt ?? null) : null,
  );
  const [ack, setAck] = useState(0);
  const [ready, setReady] = useState(false);
  // Republish so a long session picks up a refreshed access token.
  const [tokenTick, setTokenTick] = useState(0);
  useEffect(() => {
    if (!ready || !sessionId) return;
    const id = window.setInterval(() => setTokenTick((n) => n + 1), 10 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [ready, sessionId]);

  useEffect(() => {
    if (!plugin || !activeKnown) return;
    let cancel = false;
    void (async () => {
      try {
        if (!sessionId) {
          await plugin.clear();
          if (!cancel) setReady(false);
          return;
        }
        const snap = await plugin.sync();
        if (snap.sessionId !== sessionId) {
          await plugin.clear();
          if (cancel) return;
          setAck(0);
          setReady(true);
          return;
        }
        await queryClient.refetchQueries({ queryKey: qk.session(sessionId) });
        if (cancel) return;
        const localEnd =
          useTimerStore.getState().state.status === "running"
            ? (useTimerStore.getState().state.endAt ?? 0)
            : 0;
        if (snap.restEndAt > Date.now()) useTimerStore.getState().adopt(snap.restEndAt);
        else if (localEnd <= Date.now() && snap.revision > 0) useTimerStore.getState().adopt(null);
        setAck(snap.revision);
        setReady(true);
      } catch {
        // A failed sync must not block the publish. The watch stays idle otherwise.
        if (!cancel && sessionId) {
          setAck(0);
          setReady(true);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [plugin, sessionId, activeKnown]);

  useEffect(() => {
    if (!plugin) return;
    let remove: (() => Promise<void>) | undefined;
    void plugin
      .addListener("action", (event) => {
        void (async () => {
          if (event.type === "error") return;
          if (event.restEndAt > Date.now()) useTimerStore.getState().adopt(event.restEndAt);
          else useTimerStore.getState().adopt(null);
          if (sessionId) await queryClient.refetchQueries({ queryKey: qk.session(sessionId) });
          setAck(event.revision);
        })();
      })
      .then((handle) => {
        remove = () => handle.remove();
      });
    return () => {
      void remove?.();
    };
  }, [plugin, sessionId]);

  useEffect(() => {
    if (!plugin || !ready || !sessionId || !session) return;
    const payload = buildWatchPayload(
      session.exercises.map((exercise) => ({
        name: exercise.exercise?.name ?? "Exercise",
        restSec: exercise.restSec,
        supersetGroup: exercise.supersetGroup,
        sets: (exercise.sets ?? []).map((set) => ({
          id: set.id,
          order: set.order,
          weight: set.weight,
          reps: set.reps,
          completed: set.completed,
        })),
      })),
      unit,
      restEndAt,
      ack,
      sessionId,
    );
    void (async () => {
      let token = "";
      try {
        const { data } = await getSupabase().auth.getSession();
        token = data.session?.access_token ?? "";
      } catch {
        token = "";
      }
      if (!token) token = "demo-token";
      try {
        await plugin.publish({
          payload: JSON.stringify(payload),
          token,
          apiBase: window.location.origin,
        });
      } catch {
        // The next session or timer change publishes again.
      }
    })();
  }, [plugin, ready, sessionId, session, unit, restEndAt, ack, tokenTick]);

  return null;
}
