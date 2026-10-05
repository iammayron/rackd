---
module: Web PWA
date: 2026-06-23
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Page header (e.g. 'Stats') drew underneath the iOS status bar / notch in the home-screen PWA"
  - "Bottom tab bar sat under the home indicator"
  - "Only affected the installed (Add to Home Screen) app, not the browser tab"
root_cause: config_error
resolution_type: code_fix
severity: medium
tags: [pwa, ios, safe-area, viewport-fit, css, sticky, env-insets]
---

# Troubleshooting: iOS PWA content drawing under the status bar and home indicator

## Problem

After "Add to Home Screen", the MyFit PWA rendered edge-to-edge: the top header collided with the status bar/notch and the bottom tab bar overlapped the home indicator. The app declares `viewport-fit=cover` and a `black-translucent` status bar, which intentionally extends the web view under the system chrome — but nothing applied `env(safe-area-inset-*)` padding to compensate.

## Environment

- Module: Web PWA (`apps/web`, Next.js App Router)
- Affected Component: `apps/web/src/app/globals.css` (`.app-shell`), `apps/web/src/components/Nav.tsx` (bottom tab bar)
- Config that triggers it: `apps/web/src/app/layout.tsx` — `viewport.viewportFit: "cover"` + `appleWebApp.statusBarStyle: "black-translucent"`
- Date: 2026-06-23

## Symptoms

- Top page header overlapped the status bar clock/icons (visible in the Stats screen screenshot).
- Bottom `<nav>` tab labels ran into the home indicator area.
- Reproduced only in the installed PWA (cover viewport active); a normal Safari tab looked fine.

## What Didn't Work

**Considered: top inset via `padding-top` on `.app-shell` alone**

- **Why it failed (in reasoning):** each page wrapper is `min-h-[100dvh]`. Adding `padding-top` to a `border-box` `.app-shell` whose child still forces a full `100dvh` makes the child overflow by the inset amount, so the page scrolls and the sticky nav drifts below the viewport.

**Considered: bottom inset via `padding-bottom` on `.app-shell`**

- **Why it failed (in reasoning):** the tab bar is `position: sticky; bottom: 0`. Sticky anchors to the scroll container / viewport, NOT to the shell's padding box, so the nav still pins to the true viewport bottom and overlaps the home indicator regardless of shell padding.

## Solution

Two targeted changes — one CSS rule (covers every page for top + sides) and one shared component class (bottom).

**`apps/web/src/app/globals.css`** — top + side insets on the shell, and recompute full-height wrappers:

```css
/* Before (no safe-area handling): */
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
}

/* After: */
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
/* Full-height wrappers must subtract the top inset the shell added,
   or they overflow by that amount and the sticky nav drifts off-screen. */
.app-shell .min-h-\[100dvh\] {
  min-height: calc(100dvh - env(safe-area-inset-top));
}
```

**`apps/web/src/components/Nav.tsx`** — bottom inset on the sticky nav itself:

```tsx
// Before:
<nav className="sticky bottom-0 flex border-t border-[var(--border)] bg-[var(--bg)]">
// After:
<nav className="sticky bottom-0 flex border-t border-[var(--border)] bg-[var(--bg)] pb-[env(safe-area-inset-bottom)]">
```

**Verify the insets shipped in the built bundle:**

```bash
CSS=$(curl -s http://localhost:3000 | grep -oE '/_next/static/css/[^"]+\.css' | head -1)
curl -s "http://localhost:3000$CSS" | grep -o "safe-area-inset-[a-z]*" | sort -u
# expect: safe-area-inset-bottom / -left / -right / -top
```

## Why This Works

1. **Root cause:** `viewport-fit=cover` + a translucent status bar deliberately place the web view beneath the system UI; the layout never reserved space for it with `env(safe-area-inset-*)`.
2. **Top + sides on `.app-shell`:** the shell wraps every page, so one rule fixes the header on all routes. Because Tailwind's preflight sets `box-sizing: border-box`, `min-height: 100dvh` includes the new `padding-top`, shrinking the content box by exactly the inset.
3. **Recompute `.min-h-[100dvh]`:** page wrappers explicitly force `100dvh`; left alone they'd exceed the shell's content box and push the sticky nav past the viewport. Overriding them to `calc(100dvh - env(safe-area-inset-top))` (a `.app-shell .min-h-\[100dvh\]` selector that outranks the single-class utility) keeps them flush.
4. **Bottom inset on the nav, not the shell:** `position: sticky; bottom: 0` resolves against the viewport, so shell padding can't move it. Padding the nav element itself lifts its content above the home indicator while it stays pinned.

## Prevention

- Any time `viewport-fit=cover` or a translucent status bar is enabled, budget `env(safe-area-inset-*)` for top, bottom, AND sides (landscape notch) up front.
- Put bottom-edge insets on the **sticky/fixed element itself** — never expect an ancestor's padding to move a `position: sticky/fixed` child.
- When a shell adds top padding under `box-sizing: border-box`, audit descendants that hard-code `100dvh`/`100vh`; recompute them to subtract the inset or they overflow.
- Test the installed PWA (Add to Home Screen), not just the browser tab — the cover viewport only fully engages standalone. Remember the service worker caches the shell; unregister/re-add to home screen to pick up changes.

## Related Issues

No related issues documented yet.
