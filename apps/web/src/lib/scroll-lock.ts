"use client";

import { useEffect } from "react";

/**
 * Body scroll lock for modal overlays, reference-counted.
 *
 * Counting matters: a confirm sheet can open on top of another sheet, and the
 * inner one closing must not unlock the page while the outer one is still up.
 * Only the first lock captures the previous inline styles and only the last
 * release restores them.
 *
 * This is for *modal* surfaces (`aria-modal`), where the background genuinely
 * should not scroll. Non-blocking surfaces — the rest dock, the mini workout
 * bar — deliberately do not lock: resting shouldn't trap you on the page.
 */
let locks = 0;
let prevOverflow = "";
let prevOverscroll = "";

function lock() {
  if (locks++ > 0) return;
  const { body } = document;
  prevOverflow = body.style.overflow;
  prevOverscroll = body.style.overscrollBehavior;
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
}

function release() {
  locks = Math.max(0, locks - 1);
  if (locks > 0) return;
  const { body } = document;
  body.style.overflow = prevOverflow;
  body.style.overscrollBehavior = prevOverscroll;
}

/** Lock body scroll while `active`; released on cleanup. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lock();
    return release;
  }, [active]);
}
