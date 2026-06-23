"use client";

import { useEffect, useState } from "react";

/**
 * Theme controller. Light is the default; the choice persists and "system"
 * follows the OS live. Initial paint is set by the no-FOUC inline script in
 * layout.tsx — this module owns subsequent reads/writes + OS-change tracking.
 */
export type Theme = "light" | "dark" | "system";

const KEY = "rackd-theme";

function resolve(t: Theme): "light" | "dark" {
  if (t === "system") {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return t;
}

function apply(t: Theme) {
  document.documentElement.setAttribute("data-theme", resolve(t));
}

export function getTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  return (localStorage.getItem(KEY) as Theme) || "system";
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  apply(t);
}

/** React binding: current choice + a setter, with live OS-preference tracking. */
export function useTheme() {
  const [theme, set] = useState<Theme>("system");

  useEffect(() => {
    set(getTheme());
    const m = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getTheme() === "system") apply("system");
    };
    m.addEventListener("change", onChange);
    return () => m.removeEventListener("change", onChange);
  }, []);

  return {
    theme,
    setTheme: (t: Theme) => {
      setTheme(t);
      set(t);
    },
  };
}
