/**
 * Shared, platform-agnostic UI: the Rackd design-system components + token map
 * + helpers. Components are inline-styled against the CSS token vars in
 * tokens.css, so they theme automatically and are reusable by a future RN shell.
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

// ── Design-system components ─────────────────────────────────────────────────
export { Button } from "./components/Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./components/Button";
export { Card } from "./components/Card";
export type { CardProps, CardVariant } from "./components/Card";
export { Badge } from "./components/Badge";
export type { BadgeProps, BadgeTone } from "./components/Badge";
export { Avatar } from "./components/Avatar";
export type { AvatarProps } from "./components/Avatar";
export { Input } from "./components/Input";
export type { InputProps } from "./components/Input";
export { SegmentedControl } from "./components/SegmentedControl";
export type { SegmentedControlProps, SegmentedOption } from "./components/SegmentedControl";
export { StatTile } from "./components/StatTile";
export type { StatTileProps } from "./components/StatTile";
export { ProgressBar } from "./components/ProgressBar";
export type { ProgressBarProps } from "./components/ProgressBar";
export { SelectableRow } from "./components/SelectableRow";
export type { SelectableRowProps } from "./components/SelectableRow";
export { TabBar } from "./components/TabBar";
export type { TabBarProps, TabItem } from "./components/TabBar";
export { RestTimerRing } from "./components/RestTimerRing";
export type { RestTimerRingProps } from "./components/RestTimerRing";
export { SetRow } from "./components/SetRow";
export type { SetRowProps } from "./components/SetRow";
