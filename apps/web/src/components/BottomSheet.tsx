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
  /**
   * Optional non-scrolling header (title, search, close…) pinned below the drag
   * handle and above the scroll area. Use this instead of a `sticky` header
   * inside `children` — a sticky header sits *inside* the scrollport, so the
   * first row can peek through the padding strip above it. This block is a
   * sibling of the scroll area, so content is always clipped beneath it.
   */
  header,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  // "pending" = a content gesture we haven't decided is a dismiss-drag vs a
  // scroll; "dragging" = committed to dismissing; "none" = idle.
  const dragMode = useRef<"none" | "pending" | "dragging">("none");
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

  // Drag-down to dismiss. From the handle it always drags; from the scrolling
  // content it only becomes a dismiss-drag when the list is already at the top
  // and the finger moves down — otherwise it's left as a normal scroll.
  function onHandleDown(e: PointerEvent) {
    dragStart.current = e.clientY;
    dragMode.current = "dragging";
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onContentDown(e: PointerEvent) {
    dragStart.current = e.clientY;
    dragMode.current = "pending";
  }
  function onPointerMove(e: PointerEvent) {
    if (dragStart.current == null) return;
    const dy = e.clientY - dragStart.current;
    if (dragMode.current === "pending") {
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      if (dy > 6 && atTop) {
        dragMode.current = "dragging";
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } else if (dy > 6) {
        // Content isn't at the top → it's a scroll, not a dismiss. Bail out.
        dragStart.current = null;
        dragMode.current = "none";
        return;
      } else {
        return;
      }
    }
    if (dragMode.current === "dragging") setDragY(Math.max(0, dy));
  }
  function onPointerUp() {
    if (dragStart.current == null) return;
    const dismissed = dragY > 90;
    dragStart.current = null;
    dragMode.current = "none";
    if (dismissed) onClose();
    else setDragY(0);
  }
  const dragging = dragY > 0 || dragStart.current != null;

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
          onPointerDown={onHandleDown}
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

        {header && <div className="shrink-0 px-4 pb-3">{header}</div>}

        <div
          ref={scrollRef}
          onPointerDown={onContentDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="overflow-y-auto px-4 pt-2 pb-[calc(16px+env(safe-area-inset-bottom))]"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
