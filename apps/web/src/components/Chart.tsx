"use client";

const W = 320;
const H = 120;
const PAD = 8;

function scaleY(v: number, min: number, max: number): number {
  if (max === min) return H / 2;
  const t = (v - min) / (max - min);
  return H - PAD - t * (H - PAD * 2);
}

/** Minimal SVG line chart for a numeric series (e.g. est 1RM over time). */
export function LineChart({ data, unit = "" }: { data: number[]; unit?: string }) {
  if (data.length === 0) {
    return <Empty />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;
  const pts = data.map((v, i) => [PAD + i * step, scaleY(v, min, max)] as const);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="trend chart">
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 4 : 2.5} fill="var(--accent)" />
      ))}
      <text x={PAD} y={12} fill="var(--text-muted)" fontSize={11}>
        {max}
        {unit}
      </text>
      <text x={PAD} y={H - 2} fill="var(--text-muted)" fontSize={11}>
        {min}
        {unit}
      </text>
    </svg>
  );
}

/** Minimal SVG bar chart (e.g. volume per session). */
export function BarChart({ data, unit = "" }: { data: number[]; unit?: string }) {
  if (data.length === 0) {
    return <Empty />;
  }
  const max = Math.max(...data, 1);
  const gap = 3;
  const bw = (W - PAD * 2 - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="bar chart">
      {data.map((v, i) => {
        const h = (v / max) * (H - PAD * 2);
        return (
          <rect
            key={i}
            x={PAD + i * (bw + gap)}
            y={H - PAD - h}
            width={bw}
            height={h}
            rx={2}
            fill="var(--accent)"
            opacity={i === data.length - 1 ? 1 : 0.6}
          />
        );
      })}
      <text x={PAD} y={12} fill="var(--text-muted)" fontSize={11}>
        {max}
        {unit}
      </text>
    </svg>
  );
}

function Empty() {
  return (
    <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", padding: "var(--space-4) 0" }}>
      Not enough data yet.
    </div>
  );
}
