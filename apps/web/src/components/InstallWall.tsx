"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

/**
 * Whether the app is running as an installed PWA (launched from the home screen)
 * rather than a browser tab. `null` while detecting (client-only).
 *
 * Escapes so the wall never blocks the wrong context:
 *  - `?wall=1` or localStorage `rackd.forceWall=1` forces the wall (preview it).
 *  - outside production we treat it as installed (a dev browser tab is never
 *    standalone, so the wall would otherwise block local development).
 */
export function useIsInstalled(): boolean | null {
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forceWall =
      params.get("wall") === "1" || window.localStorage.getItem("rackd.forceWall") === "1";
    if (forceWall) {
      setInstalled(false);
      return;
    }
    if (
      process.env.NODE_ENV !== "production" ||
      window.location.hostname.includes("run.app") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      setInstalled(true);
      return;
    }
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
  }, []);
  return installed;
}

/** iOS share glyph used in the install steps. */
function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block h-[18px] w-[18px] align-text-bottom"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

/**
 * Install gate shown until Rackd is added to the home screen. Rackd is
 * install-only (no in-browser login), so this stands in front of the auth gate
 * for anyone who opened it in a plain browser tab.
 */
export function InstallWall() {
  const isIOS = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-8 text-center">
      <Logo size={84} />

      <div>
        <h1 className="text-2xl font-extrabold">
          Add Rackd to your
          <br />
          Home Screen
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[var(--text-muted)]">
          Rackd runs as an app. Install it to continue. It launches full-screen, works offline, and
          delivers your rest-timer alerts.
        </p>
      </div>

      {isIOS ? (
        <ol className="m-0 flex max-w-sm list-none flex-col gap-3 p-0 text-left">
          {[
            <>
              Tap the Share button <ShareGlyph /> in the Safari toolbar.
            </>,
            <>
              Scroll down and choose <strong>“Add to Home Screen”</strong>.
            </>,
            <>
              Open <strong>Rackd</strong> from your Home Screen.
            </>,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold"
                style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
              >
                {i + 1}
              </span>
              <span className="pt-0.5 text-[15px] leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="max-w-sm text-[var(--text-muted)]">
          Rackd is an iPhone app. Open <strong>rackd.fly.dev</strong> in Safari on your iPhone and
          add it to your Home Screen to continue.
        </p>
      )}
    </div>
  );
}
