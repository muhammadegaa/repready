import { ringGeometry } from "@/lib/charts";

// A ring that fills to value/max. `display` is the text in the middle (defaults to the value).
export function Ring({ value, max, display, size = 80, label }: { value: number; max: number; display?: string; size?: number; label: string }) {
  const r = 38;
  const { c, off } = ringGeometry(value, max, r);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label} className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r} fill="none" stroke="var(--brand)" strokeWidth="10" strokeLinecap="round" transform="rotate(-90 50 50)"
        className="ring-arc" strokeDasharray={c} strokeDashoffset={off} style={{ "--from": c } as React.CSSProperties}
      />
      <text x="50" y="58" textAnchor="middle" className="fill-ink font-display" style={{ fontSize: 30 }}>{display ?? value}</text>
    </svg>
  );
}

// A summary card with a ring beside the label, for the numbers that are a share of something.
export function RingStat({ label, value, max, hint, valueNode }: { label: string; value: number; max: number; hint?: string; valueNode: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
      <Ring value={value} max={max} size={56} label={`${label}: ${value} of ${max}`} display={max > 0 ? `${Math.round((value / max) * 100)}%` : "–"} />
      <div className="min-w-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{valueNode}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}
