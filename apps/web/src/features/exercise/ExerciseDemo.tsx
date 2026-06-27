"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Looping exercise demo from the source's start/end photos (free-exercise-db
 * ships 2 frames per exercise). Cross-fading them on a loop reads as a short
 * motion clip — no gif/video asset needed. Honors prefers-reduced-motion
 * (shows the first frame, static). Tap to view fullscreen.
 */
export function ExerciseDemo({
  frames,
  alt,
  holdMs = 900,
  className = "",
}: {
  frames: string[];
  alt: string;
  holdMs?: number;
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (frames.length < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(() => setActive((i) => (i + 1) % frames.length), holdMs);
    return () => clearInterval(t);
  }, [frames.length, holdMs]);

  return (
    <div
      ref={containerRef}
      onClick={() => containerRef.current?.requestFullscreen?.()}
      className={`absolute inset-0 cursor-pointer ${className}`}
    >
      {frames.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={url}
          alt={i === 0 ? alt : ""}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
          style={{ opacity: i === active ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
