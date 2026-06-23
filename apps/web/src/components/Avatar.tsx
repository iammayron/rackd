/**
 * Profile photo with a graceful fallback. Renders the image when `src` is set,
 * otherwise a placeholder showing the first initial (or a generic glyph). Plain
 * <img> — profile photos are external CDN/MinIO URLs, not next/image-optimized.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = name?.trim()?.[0]?.toUpperCase() ?? "";
  const style = { width: size, height: size } as const;
  const base =
    "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden " +
    "bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)]";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ? `${name}'s photo` : "Profile photo"}
        width={size}
        height={size}
        style={style}
        className={`${base} object-cover ${className}`}
      />
    );
  }
  return (
    <span style={style} className={`${base} font-semibold ${className}`} aria-hidden={!initial}>
      {initial || (
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-1/2 h-1/2" aria-label="No photo">
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v2h16v-2c0-3.3-3.6-6-8-6Z" />
        </svg>
      )}
    </span>
  );
}
