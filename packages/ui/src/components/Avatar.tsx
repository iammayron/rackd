"use client";

import * as React from "react";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Photo URL; falls back to the name's initial when absent. */
  src?: string | null;
  name?: string;
  /** Square size in px. @default 44 (the min tap target) */
  size?: number;
}

/**
 * Circular avatar. Falls back to the user's initial on accent-wash when no
 * photo. Square crop, pill radius. Sizes default to the 44px tap target.
 */
export function Avatar({ src, name, size = 44, style, ...rest }: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--accent-wash)",
        color: "var(--accent)",
        fontFamily: "var(--font-sans)",
        fontWeight: 800,
        fontSize: size * 0.42,
        border: "1px solid var(--border)",
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}
