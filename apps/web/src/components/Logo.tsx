/** The Rackd app mark (coral squircle + "R"), reused on auth and install screens. */
export function Logo({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/icon-maskable.svg"
      alt="Rackd"
      width={size}
      height={size}
      className={`rounded-[23%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
