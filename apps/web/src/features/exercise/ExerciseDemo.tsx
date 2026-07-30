"use client";

import { useEffect, useState } from "react";
import { useBodyScrollLock } from "@/lib/scroll-lock";

/**
 * Looping exercise demo from the source's start/end photos (free-exercise-db
 * ships 2 frames per exercise). Cross-fading them on a loop reads as a short
 * motion clip — no gif/video asset needed. Tap to open a fullscreen lightbox
 * (works on iOS, where requestFullscreen on non-video elements is unsupported).
 * Honors prefers-reduced-motion (static first frame).
 */

const FADE_MS = 700;

export function ExerciseDemo({
  frames,
  alt,
  holdMs = 1400,
}: {
  frames: string[];
  alt: string;
  holdMs?: number;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  // Advance frames; the fade is a CSS opacity transition so the swap eases
  // rather than cuts. holdMs is the dwell on a frame between cross-fades.
  useEffect(() => {
    if (frames.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % frames.length), holdMs);
    return () => clearInterval(t);
  }, [frames.length, holdMs]);

  // Esc to close. Background scroll is locked through the shared counter — this
  // lightbox opens from inside a sheet that already holds a lock, and a
  // hand-rolled save/restore here would hand the page back while the sheet is
  // still up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useBodyScrollLock(open);

  const layers = (fit: "cover" | "contain") =>
    frames.map((url, i) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={i}
        src={url}
        alt={i === 0 ? alt : ""}
        className={`absolute inset-0 h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} ease-in-out`}
        style={{ opacity: i === active ? 1 : 0, transition: `opacity ${FADE_MS}ms` }}
      />
    ));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Expand ${alt} demonstration`}
        className="absolute inset-0 m-0 border-0 bg-transparent p-0 cursor-zoom-in"
      >
        {layers("cover")}
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white text-sm leading-none backdrop-blur-sm"
        >
          ⤢
        </span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} demonstration`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
        >
          <div className="relative w-full max-w-2xl" style={{ height: "min(80vh, 90vw)" }}>
            {layers("contain")}
          </div>
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
