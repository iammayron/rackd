"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** @default "left" */
  align?: React.CSSProperties["textAlign"];
  /** Trailing unit hint (e.g. "kg"). */
  suffix?: React.ReactNode;
  /** Style for the relative wrapper (the input itself uses `style`). */
  wrapStyle?: React.CSSProperties;
}

/**
 * Text / number input. Large 44px target, surface-2 fill, coral focus ring.
 * `align` center is used for the weight/reps set cells. `suffix` shows a unit.
 */
export function Input({
  align = "left",
  suffix,
  style,
  wrapStyle,
  className,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", ...wrapStyle }}>
      <input
        className={["rk-squircle-corners", className].filter(Boolean).join(" ")}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={{
          width: "100%",
          minHeight: "var(--tap-min)",
          padding: suffix ? "0 34px 0 14px" : "0 14px",
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          fontWeight: 600,
          textAlign: align,
          color: "var(--text)",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          outline: "none",
          boxShadow: focus ? "0 0 0 2px var(--ring)" : "none",
          borderColor: focus ? "var(--accent)" : "var(--border)",
          transition:
            "box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)",
          fontVariantNumeric: "tabular-nums",
          ...style,
        }}
        {...rest}
      />
      {suffix && (
        <span
          style={{
            position: "absolute",
            right: 12,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}
