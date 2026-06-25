"use client";

import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** @default "primary" */
  variant?: ButtonVariant;
  /** @default "md" */
  size?: ButtonSize;
  /** @default false */
  fullWidth?: boolean;
  children?: React.ReactNode;
}

/**
 * Rackd primary button. Pill-ish radius, confident weight, springy press.
 * Variants: primary (coral), secondary (surface), ghost (text-only),
 * success (completed-set green), danger.
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  type = "button",
  onClick,
  style,
  className,
  ...rest
}: ButtonProps) {
  const sizes: Record<ButtonSize, React.CSSProperties & { radius: string }> = {
    sm: { height: 40, padding: "0 14px", fontSize: 14, radius: "var(--radius-sm)" },
    md: { height: 48, padding: "0 20px", fontSize: 16, radius: "var(--radius)" },
    lg: { height: "var(--tap-cta)", padding: "0 24px", fontSize: 18, radius: "var(--radius-md)" },
  };
  const s = sizes[size] ?? sizes.md;

  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "var(--text-on-accent)", border: "1px solid transparent", boxShadow: "var(--shadow-sm)" },
    secondary: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--accent)", border: "1px solid transparent" },
    success: { background: "var(--success)", color: "var(--success-ink)", border: "1px solid transparent" },
    danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
  };
  const v = variants[variant] ?? variants.primary;

  const [pressed, setPressed] = React.useState(false);

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={["rk-squircle-corners", className].filter(Boolean).join(" ")}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.height,
        minHeight: size === "lg" ? "var(--tap-cta)" : undefined,
        width: fullWidth ? "100%" : undefined,
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.fontSize,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        borderRadius: s.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transform: pressed && !disabled ? "scale(0.97)" : "scale(1)",
        transition:
          "transform var(--dur-fast) var(--ease-out), background var(--dur) var(--ease-out), filter var(--dur) var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
        ...v,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
