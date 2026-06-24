"use client";

import { useEffect } from "react";

/**
 * Keep Rackd portrait-only, app-wide.
 *
 * Two layers, because no single approach covers every platform:
 *  - Android/Chromium honour `screen.orientation.lock("portrait")`, so we ask
 *    for it best-effort. iOS Safari / installed PWAs don't implement it (it
 *    throws or rejects), and the manifest `orientation` is ignored there too —
 *    so the real guard on iPhone is the CSS overlay in globals.css
 *    (`.rk-rotate-guard`), which covers the screen whenever a phone is held in
 *    landscape. The portrait layout stays mounted underneath, just hidden.
 */
export function OrientationGuard() {
  useEffect(() => {
    // Best-effort lock — unsupported browsers (iOS) throw or reject; swallow it.
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: "portrait") => Promise<void>;
      };
      void orientation?.lock?.("portrait")?.catch(() => {});
    } catch {
      /* lock unsupported — CSS overlay handles it */
    }
  }, []);

  return (
    <div className="rk-rotate-guard" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="44"
        height="44"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* phone held in portrait */}
        <rect x="8" y="3" width="8" height="18" rx="2" />
        <line x1="11" y1="18" x2="13" y2="18" />
        {/* curved "rotate" arrow sweeping up to the phone */}
        <path d="M3.5 14a8 8 0 0 1 2.4-5.6" />
        <polyline points="2 11.5 3.5 14.5 6.4 13" />
      </svg>
      <p className="rk-rotate-guard__text">Rotate your device to portrait</p>
    </div>
  );
}
