"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";

interface ConfirmOptions {
  title: string;
  /** Optional supporting copy under the title. */
  message?: string;
  /** Confirm button label (defaults to "Delete"). */
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Reliable in-app confirmation built on {@link BottomSheet} — a drop-in
 * replacement for `window.confirm`, which is unreliable in iOS standalone/PWA
 * mode (it may silently no-op, so destructive actions fire with no prompt).
 * Renders a danger confirm + cancel; BottomSheet handles focus, Esc, backdrop.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title}>
      {message && <p className="px-1 pb-3 text-sm text-[var(--text-muted)]">{message}</p>}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className="rk-squircle-corners w-full rounded-[var(--radius-md)] bg-[var(--danger)] py-3.5 text-center font-bold text-white"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rk-squircle-corners w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-3.5 text-center font-bold text-[var(--text)]"
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

/**
 * App-wide confirmation. Mount `<ConfirmProvider>` once near the root, then any
 * client component can do:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message })) { …destructive… }
 *
 * A single dialog is shared by the whole tree, so per-row components (every
 * SetRow, every ExerciseCard) can ask for confirmation without each mounting a
 * sheet of their own. Resolves true on confirm, false on cancel/dismiss.
 */
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmOptions & { open: boolean }>({
    open: false,
    title: "",
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        // A second request while one is open would strand the first promise —
        // settle it as cancelled so no caller is left awaiting forever.
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setState({ ...opts, open: true });
      }),
    [],
  );

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.title}
        message={state.message}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>");
  return ctx;
}
