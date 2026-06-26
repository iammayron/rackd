"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent, ReactNode } from "react";

/**
 * Generic bottom sheet: slides up from the bottom over a dim backdrop. Owns the
 * animation, dismissal (backdrop tap / Escape / drag-down), focus management,
 * aria, safe-area padding and z-index. Reduced-motion is handled globally in
 * globals.css (durations collapse to ~0).
 *
 * Keep this API generic — feature-specific UI goes in `children`. Existing
 * sheets/pickers (e.g. SaveBackSheet) are candidates to adopt this later.
 *
 * @example
 * <BottomSheet open={open} onClose={() => setOpen(false)} title="Effort · RPE">
 *   …content…
 * </BottomSheet>
 */
export function BottomSheet({
  open,
  onClose,
  title,
  /** Optional secondary text shown next to the title. */
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  // Height the on-screen keyboard overlaps into the layout viewport, so the
  // sheet can sit above it instead of being hidden behind it (see effect below).
  const [kbInset, setKbInset] = useState(0);

  // Accessible dialog: focus the sheet on open, close on Escape.
  useEffect(() => {
    if (!open) return;
    // Pull focus into the dialog (a11y) only as a deferred fallback: if the
    // content already focused something (e.g. an input), leave it — stealing
    // focus to the panel here would blur the field and dismiss the mobile
    // keyboard. Escape still works via the window listener regardless.
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) {
        panel.focus({ preventScroll: true });
      }
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Lift the sheet above the on-screen keyboard. A position:fixed sheet stays
  // pinned to the layout viewport, so the keyboard covers it; the VisualViewport
  // API reports how much the keyboard shrank the visible area, which we apply as
  // a bottom offset on the panel.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbInset(0);
    };
  }, [open]);

  // Reset drag offset whenever the sheet (re)opens.
  useEffect(() => {
    if (open) setDragY(0);
  }, [open]);

  if (!open) return null;

  // Drag-down to dismiss, grabbed from the handle/header.
  function onPointerDown(e: PointerEvent) {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (dragStart.current == null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  }
  function onPointerUp() {
    if (dragStart.current == null) return;
    const dismissed = dragY > 90;
    dragStart.current = null;
    if (dismissed) onClose();
    else setDragY(0);
  }
  const dragging = dragStart.current != null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-black/50 rk-backdrop-in"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="rk-squircle-corners relative w-[min(440px,100%)] max-h-[88vh] flex flex-col overflow-hidden bg-[var(--bg)] rounded-t-[var(--radius-lg)] shadow-[var(--shadow-lg)] outline-none rk-sheet-up"
        style={{
          marginBottom: kbInset || undefined,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging
            ? "none"
            : "transform var(--dur) var(--ease-out), margin-bottom var(--dur) var(--ease-out)",
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="shrink-0 cursor-grab touch-none pt-2.5 pb-1"
        >
          <span className="mx-auto block w-[38px] h-[5px] rounded-full bg-[var(--border)]" />
          {(title || subtitle) && (
            <div className="flex items-baseline justify-between gap-3 px-5 pt-2">
              {title && <h2 className="text-[17px] font-extrabold">{title}</h2>}
              {subtitle && (
                <span className="text-[13px] text-[var(--text-muted)]">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        <div className="overflow-y-auto px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
