/**
 * Shared, platform-agnostic UI helpers + token type map.
 * Components live in apps for now (KISS) — extract here once a 2nd app needs them.
 */
export const tokens = {
  color: {
    bg: "var(--bg)",
    surface: "var(--surface)",
    accent: "var(--accent)",
    success: "var(--success)",
    danger: "var(--danger)",
    text: "var(--text)",
    textMuted: "var(--text-muted)",
  },
  radius: { sm: "var(--radius-sm)", base: "var(--radius)", lg: "var(--radius-lg)" },
} as const;

export function mmss(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
