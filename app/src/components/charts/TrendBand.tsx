import { runs, scale } from "@/lib/charts";
import { standing, usualRange } from "@/lib/baseline";

const W = 360, H = 132, L = 30, R = 10, T = 10, B = 22;

// One measure over the last days, drawn against this player's own usual range (the days before the last one). Describes only.
export function TrendBand({ title, unit, values, days, domain, room, worse, decimals = 0 }: {
  title: string; unit: string; values: (number | null)[]; days: string[]; domain: [number, number]; room: number; worse: "lower" | "higher"; decimals?: number;
}) {
  const x = scale(0, values.length - 1, L, W - R);
  const y = scale(domain[1], domain[0], T, H - B);
  const clampY = (v: number) => y(Math.max(domain[0], Math.min(domain[1], v)));
  const usual = usualRange(values.slice(0, -1), room);
  const last = values[values.length - 1];
  const st = standing(last, usual);
  const fmt = (v: number) => v.toFixed(decimals);
  const d = runs(values).map((r) => "M" + r.map((i) => `${x(i).toFixed(1)} ${clampY(values[i]!).toFixed(1)}`).join(" L")).join(" ");
  const ticks = [domain[0], (domain[0] + domain[1]) / 2, domain[1]];
  const outside = (v: number) => usual !== null && (worse === "lower" ? v < usual.low : v > usual.high);
  const alt = `${title}, last ${values.length} days. ${last === null ? "No answer today." : `Today ${fmt(last)}${unit}${usual ? `, ${st === "usual" ? "within" : st} the usual ${fmt(usual.low)} to ${fmt(usual.high)}${unit}` : ""}.`}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className={`text-xs ${last !== null && outside(last) ? "text-warn" : "text-muted"}`}>
          {last === null ? "no answer today" : `${fmt(last)}${unit} today${usual ? ` · usual ${fmt(usual.low)} to ${fmt(usual.high)}` : ""}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={alt}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 3.5} textAnchor="end" className="fill-muted font-mono" style={{ fontSize: 9 }}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
          </g>
        ))}
        {usual && <rect className="tb-band" x={L} y={clampY(usual.high)} width={W - L - R} height={Math.max(2, clampY(usual.low) - clampY(usual.high))} fill="var(--brand-soft)" />}
        <path className="tb-line" d={d} pathLength={1} fill="none" stroke="var(--brand)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((v, i) => v === null ? null : (
          <circle key={i} className="tb-dot" style={{ "--i": i } as React.CSSProperties} cx={x(i)} cy={clampY(v)} r={i === values.length - 1 ? 4.5 : 2.5} fill={outside(v) ? "var(--warn)" : "var(--brand)"} />
        ))}
        {[0, Math.floor((values.length - 1) / 2), values.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"} className="fill-muted font-mono" style={{ fontSize: 9 }}>{i === values.length - 1 ? "today" : Number(days[i].slice(8))}</text>
        ))}
      </svg>
    </figure>
  );
}

// Effort against the plan, day by day: up is harder than planned, down is easier.
export function DeltaBars({ title, values, days, limit = 3 }: { title: string; values: (number | null)[]; days: string[]; limit?: number }) {
  const mid = (T + (H - B)) / 2;
  const half = (H - B - T) / 2;
  const x = scale(0, values.length - 1, L + 8, W - R - 8);
  const bw = 14;
  const answered = values.filter((v): v is number => v !== null);
  const alt = `${title}, last ${values.length} days. ${answered.length === 0 ? "No session effort logged." : `${answered.filter((v) => v > 0).length} days harder than planned, ${answered.filter((v) => v < 0).length} easier.`}`;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2 text-sm"><span className="font-medium">{title}</span><span className="text-xs text-muted">RPE points over (+) or under (−) the plan</span></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={alt}>
        <line x1={L} x2={W - R} y1={mid} y2={mid} stroke="var(--line-strong)" strokeWidth="1" />
        <text x={L - 6} y={mid + 3.5} textAnchor="end" className="fill-muted font-mono" style={{ fontSize: 9 }}>0</text>
        {values.map((v, i) => {
          if (v === null || v === 0) return null;
          const h = Math.max(2, (Math.min(Math.abs(v), limit) / limit) * half);
          const up = v > 0;
          return <rect key={i} className={up ? "db-up" : "db-down"} style={{ "--i": i } as React.CSSProperties} x={x(i) - bw / 2} y={up ? mid - h : mid} width={bw} height={h} rx="2" fill={up ? "var(--warn)" : "var(--line-strong)"} />;
        })}
        {[0, values.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "end"} className="fill-muted font-mono" style={{ fontSize: 9 }}>{i === values.length - 1 ? "today" : Number(days[i].slice(8))}</text>
        ))}
      </svg>
    </figure>
  );
}
