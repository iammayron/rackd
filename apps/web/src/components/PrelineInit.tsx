"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Preline ships imperative JS that enhances markup (dropdowns, selects, etc.).
 * In the App Router it must be re-initialised after each client navigation,
 * once the new DOM is committed.
 */
export function PrelineInit() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    (async () => {
      await import("preline");
      if (!active) return;
      // next frame: ensure the route's DOM is painted before enhancing
      requestAnimationFrame(() => {
        (window as unknown as { HSStaticMethods?: { autoInit: () => void } }).HSStaticMethods?.autoInit();
      });
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
