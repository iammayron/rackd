"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

/** The four semantic flavors, each mapped to a design token + icon. */
export type ToastType = "success" | "error" | "warning" | "info";

/** An optional inline button rendered inside the toast (e.g. "Copy", "Undo"). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** @default "info" */
  type?: ToastType;
  /** Auto-dismiss delay in ms; pass 0 to keep until manually closed. @default 4000 */
  duration?: number;
  /** Optional action button. Tapping it runs `onClick` and dismisses the toast. */
  action?: ToastAction;
}

interface ToastItem extends Required<Omit<ToastOptions, "action">> {
  id: number;
  message: string;
  action?: ToastAction;
}

export interface ToastApi {
  /** Fire a toast with an explicit type; returns the toast id. */
  show: (message: string, options?: ToastOptions) => number;
  success: (message: string, options?: Omit<ToastOptions, "type">) => number;
  error: (message: string, options?: Omit<ToastOptions, "type">) => number;
  warning: (message: string, options?: Omit<ToastOptions, "type">) => number;
  info: (message: string, options?: Omit<ToastOptions, "type">) => number;
  /** Manually dismiss a toast by id. */
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4000;

/**
 * App-wide toast notifications. Mount once near the app root; any client
 * component can then call `useToast()` and fire `toast.success(...)` etc.
 *
 * Kept deliberately dependency-free (no Preline JS): a small React context owns
 * the queue, and a fixed viewport renders the stack at the top of the column so
 * it never clashes with the bottom nav or the mini workout bar.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Live ids whose auto-dismiss timers we still need to clear on manual close.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const type = options?.type ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATION;
      setToasts((prev) => [...prev, { id, message, type, duration, action: options?.action }]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, options) => show(message, { ...options, type: "success" }),
      error: (message, options) => show(message, { ...options, type: "error" }),
      warning: (message, options) => show(message, { ...options, type: "warning" }),
      info: (message, options) => show(message, { ...options, type: "info" }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/** Access the toast API. Throws if used outside a `ToastProvider`. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}

// ── Viewport + item ──────────────────────────────────────────────────────────

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      // Top-right, sized to content so it sits clear of the sticky bottom nav
      // and the mini workout bar. Respects the notch + right safe-area insets.
      className="pointer-events-none fixed right-0 top-0 z-50 flex flex-col items-end gap-2"
      style={{
        paddingTop: "calc(12px + env(safe-area-inset-top))",
        paddingRight: "calc(12px + env(safe-area-inset-right))",
        paddingLeft: "12px",
      }}
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

/** Per-variant token mapping: accent color + matching icon glyph. */
const VARIANTS: Record<ToastType, { color: string; tint: string; icon: React.ReactNode; label: string }> = {
  success: {
    color: "var(--success)",
    tint: "color-mix(in srgb, var(--success) 16%, transparent)",
    label: "Success",
    icon: (
      <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  error: {
    color: "var(--danger)",
    tint: "color-mix(in srgb, var(--danger) 16%, transparent)",
    label: "Error",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 7v6M12 16.5v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
  warning: {
    color: "var(--warning)",
    tint: "color-mix(in srgb, var(--warning) 18%, transparent)",
    label: "Warning",
    icon: (
      <>
        <path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 9v4M12 16.5v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
  info: {
    color: "var(--accent)",
    tint: "var(--accent-wash)",
    label: "Info",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M12 11v5M12 7.5v.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
  },
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [entered, setEntered] = useState(false);
  // Flip to the entered state on the next frame so the mount transition runs.
  const onMount = useCallback((node: HTMLDivElement | null) => {
    if (node) requestAnimationFrame(() => setEntered(true));
  }, []);

  const v = VARIANTS[toast.type];
  // Errors interrupt (assertive); everything else is polite.
  const assertive = toast.type === "error";

  return (
    <div
      ref={onMount}
      role={assertive ? "alert" : "status"}
      aria-live={assertive ? "assertive" : "polite"}
      className="pointer-events-auto flex w-fit max-w-sm items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-lg)]"
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? "translateX(0)" : "translateX(16px)",
        transition: "opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: v.tint, color: v.color }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          {v.icon}
        </svg>
      </span>
      <p className="min-w-0 flex-1 pt-0.5 text-sm font-medium text-[var(--text)]">
        <span className="sr-only">{v.label}: </span>
        {toast.message}
      </p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onDismiss(toast.id);
          }}
          className="-my-0.5 shrink-0 self-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-wash)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
