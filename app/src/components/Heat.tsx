import type { DayPoint } from "@/lib/views";

type Row = { label: string; hint: string; value: (d: DayPoint) => number | null; concern: (v: number) => number; format: (v: number) => string };

const clamp = (n: number) => Math.max(0, Math.min(1, n));

const ROWS: Row[] = [
  { label: "Sleep", hint: "hours", value: (d) => d.sleep, concern: (v) => clamp((7.5 - v) / 3.5), format: (v) => v.toFixed(1) },
  { label: "Soreness", hint: "0 to 10", value: (d) => d.soreness, concern: (v) => clamp(v / 10), format: (v) => String(v) },
  { label: "Stress", hint: "0 to 10", value: (d) => d.stress, concern: (v) => clamp(v / 10), format: (v) => String(v) },
  { label: "Effort vs plan", hint: "RPE points", value: (d) => d.rpeDelta, concern: (v) => clamp(Math.abs(v) / 3), format: (v) => (v > 0 ? `+${v}` : String(v)) },
];

// Fourteen days at a glance. Darker means more reason to look. Empty cells are days with no entry.
export function Heat({ days }: { days: DayPoint[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[96px_repeat(14,minmax(0,1fr))] gap-1 pb-1 font-mono text-[10px] text-muted">
          <span />
          {days.map((d) => (
            <span key={d.date} className="text-center">{Number(d.date.slice(8))}</span>
          ))}
        </div>
        {ROWS.map((row) => (
          <div key={row.label} className="mb-1 grid grid-cols-[96px_repeat(14,minmax(0,1fr))] items-center gap-1">
            <span className="text-xs font-medium">{row.label}</span>
            {days.map((d) => {
              const v = row.value(d);
              if (v === null) return <span key={d.date} className="h-7 rounded-[4px] border border-dashed border-line" aria-label={`${row.label} ${d.date}: none`} />;
              const c = row.concern(v);
              return (
                <span
                  key={d.date}
                  title={`${d.date}: ${row.format(v)} ${row.hint}${row.label === "Sleep" && d.device !== null ? " (device)" : ""}`}
                  className="relative flex h-7 items-center justify-center rounded-[4px] font-mono text-[10px] tabular-nums"
                  style={{ background: `color-mix(in srgb, var(--bad) ${Math.round(c * 62)}%, var(--surface))`, color: c > 0.55 ? "var(--paper)" : "var(--ink)" }}
                >
                  {row.format(v)}
                  {row.label === "Sleep" && d.device !== null && <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-ink" />}
                </span>
              );
            })}
          </div>
        ))}
        <p className="mt-2 text-[11px] text-muted">A dot on a sleep cell means the figure came from a wearable.</p>
      </div>
    </div>
  );
}
