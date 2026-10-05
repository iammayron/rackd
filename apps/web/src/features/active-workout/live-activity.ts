"use client";

import { useEffect, useRef } from "react";
import { useTimerStore } from "./timer-store";

/**
 * Android Lock Screen "Live Activity" controller.
 *
 * Uses the Web MediaSession API backed by an inaudible looping audio element.
 * On Android, this displays a persistent, ongoing controller on the lock screen
 * and in the notification shade, allowing lifters to see their remaining rest
 * and tap "Skip" or "+30s" directly from their lock screen!
 */
export function useLiveActivity(activeExerciseName?: string, currentSetInfo?: string) {
  const { state, remaining, add, skip } = useTimerStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    // Create an ambient silent audio element to anchor the media session on Android
    if (!audioRef.current) {
      // 1-second silent WAV base64
      const silentWav =
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      const audio = new Audio(silentWav);
      audio.loop = true;
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    const isRunning = state.status === "running";

    if (isRunning) {
      audio.play().catch(() => {
        // Autoplay may need user gesture
      });

      const ms = remaining();
      const totalSec = Math.max(0, Math.ceil(ms / 1000));
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Rest: ${formatted}`,
        artist: activeExerciseName || "Rackd Workout",
        album: currentSetInfo || "Resting between sets",
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        add(30);
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        skip();
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        skip();
      });

      navigator.mediaSession.setActionHandler("play", () => {
        audio.play().catch(() => {});
      });
    } else {
      if (audio) {
        audio.pause();
      }
      if (activeExerciseName) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activeExerciseName,
          artist: "Rackd Workout",
          album: currentSetInfo || "Workout in progress",
          artwork: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          ],
        });
      }
    }

    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, [state.status, state.endAt, remaining, add, skip, activeExerciseName, currentSetInfo]);
}
