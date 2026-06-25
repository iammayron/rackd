"use client";

import { useEffect } from "react";

/**
 * iOS PWA workaround. After the installed app returns from the background,
 * WebKit sometimes fails to re-lay-out `position: fixed` overlays (the rest
 * timer, bottom sheets, the mini workout bar) — they paint as if in normal
 * flow, stranded mid-page. Forcing a synchronous reflow on resume snaps them
 * back to the viewport.
 *
 * The display:none → read offsetHeight → restore dance forces a full reflow.
 * It's flash-free: all three steps run synchronously in one tick, so the
 * browser never paints a frame with the body hidden.
 */
export function ForegroundReflow() {
  useEffect(() => {
    const reflow = () => {
      if (document.visibilityState !== "visible") return;
      const b = document.body;
      const prev = b.style.display;
      b.style.display = "none";
      void b.offsetHeight; // force synchronous reflow while detached
      b.style.display = prev;
    };
    document.addEventListener("visibilitychange", reflow);
    // pageshow fires on bfcache restore (a resume path visibilitychange misses).
    window.addEventListener("pageshow", reflow);
    return () => {
      document.removeEventListener("visibilitychange", reflow);
      window.removeEventListener("pageshow", reflow);
    };
  }, []);
  return null;
}
