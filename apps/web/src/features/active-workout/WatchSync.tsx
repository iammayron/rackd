"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient, qk } from "@/lib/query";
import { getSupabase } from "@/lib/supabase";
import { useUnitStore } from "@/lib/units-store";
import { buildWatchPayload } from "./watch-payload";
import { useTimerStore } from "./timer-store";

interface WearAction {
  type: string;
  restEndAt: number;
  revision: number;
}

interface WearSnapshot {
  revision: number;
  restEndAt: number;
  sessionId: string;
}

interface WearPlugin {
  publish(opts: { payload: string; token: string; apiBase: string }): Promise<void>;
  clear(): Promise<void>;
  sync(): Promise<WearSnapshot>;
  addListener(
    event: "action",
    cb: (event: WearAction) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

interface WatchSession {
  exercises: {
    restSec: number;
    supersetGroup?: number | null;
    exercise: { name: string } | null;
    sets?: { id: string; order: number; weight: number; reps: number; completed: boolean }[];
  }[];
}

let cached: WearPlugin | null | undefined;

function wearPlugin(): WearPlugin | null {
  if (cached !== undefined) return cached;
  if (typeof window === "undefined") return null;
  const cap = (
    window as Window & {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        registerPlugin?: (name: string) => WearPlugin;
      };
    }
  ).Capacitor;
  if (!cap?.isNativePlatform?.() || !cap.registerPlugin) {
    cached = null;
    return null;
  }
  cached = cap.registerPlugin("RackdWear");
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
  const { data: active } = useQuery({
    queryKey: qk.activeSession,
    queryFn: () => api<{ id: string } | null>("/api/sessions/active"),
  });
  const sessionId = active?.id;
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
    if (!plugin) return;
    let cancel = false;
    void (async () => {
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
    })();
    return () => {
      cancel = true;
    };
  }, [plugin, sessionId]);

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
      await plugin.publish({
        payload: JSON.stringify(payload),
        token,
        apiBase: window.location.origin,
      });
    })();
  }, [plugin, ready, sessionId, session, unit, restEndAt, ack, tokenTick]);

  return null;
}
