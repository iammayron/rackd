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

  // Accessible dialog: focus the sheet on open, close on Escape.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        className="relative w-[min(440px,100%)] max-h-[88vh] flex flex-col overflow-hidden bg-[var(--bg)] rounded-t-[22px] shadow-[var(--shadow-lg)] outline-none rk-sheet-up"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform var(--dur) var(--ease-out)",
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
