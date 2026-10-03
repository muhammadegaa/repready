import { standing, usualRange, MIN_DAYS } from "@/lib/baseline";
import type { DayPoint } from "@/lib/views";
import { Card, Chip } from "./ui";

type Measure = { key: "sleep" | "soreness" | "stress"; label: string; unit: string; max: number; worse: "lower" | "higher"; room: number };
const MEASURES: Measure[] = [
  { key: "sleep", label: "Sleep", unit: " h", max: 12, worse: "lower", room: 0.5 },
  { key: "soreness", label: "Soreness", unit: " out of 10", max: 10, worse: "higher", room: 1 },
  { key: "stress", label: "Stress", unit: " out of 10", max: 10, worse: "higher", room: 1 },
];

// Today against this player's own usual range from the days before. Describes only; it never decides anything.
export function UsualToday({ days, first }: { days: DayPoint[]; first: string }) {
  const today = days[days.length - 1];
  const earlier = days.slice(0, -1);
  return (
    <Card className="space-y-4 p-5">
      <p className="text-sm text-muted">The grey band is {first}’s own usual range: their average over the days before today, plus or minus one standard deviation, and never narrower than half an hour of sleep or one point on a 0 to 10 scale. It needs at least {MIN_DAYS} earlier answers.</p>
      {MEASURES.map((m) => {
        const t = today?.[m.key] ?? null;
        const u = usualRange(earlier.map((d) => d[m.key]), m.room);
        const st = standing(t, u);
        const off = st !== null && st === m.worse;
        const pct = (x: number) => `${Math.max(0, Math.min(100, (x / m.max) * 100))}%`;
        const sentence =
          t === null ? "No answer today."
          : u === null ? `${t}${m.unit} today. Not enough history yet to compare.`
          : st === "usual" ? `${t}${m.unit} today, within the usual ${u.low} to ${u.high}${m.unit}.`
          : `${t}${m.unit} today, ${st} than the usual ${u.low} to ${u.high}${m.unit}.`;
        return (
          <div key={m.key} className="grid grid-cols-[84px_1fr] items-center gap-x-4 gap-y-1 sm:grid-cols-[84px_1fr_minmax(0,16rem)]">
            <div className="text-sm font-medium">{m.label}</div>
            <div className="relative h-2.5 rounded-full bg-paper ring-1 ring-line" aria-hidden>
              {u && <div className="absolute top-0 h-2.5 rounded-full bg-line-strong/60" style={{ left: pct(u.low), width: `max(${pct(u.high - u.low)}, 6px)` }} />}
              {t !== null && <div className={`absolute -top-1 w-1 -translate-x-1/2 rounded-full ${off ? "bg-warn" : "bg-brand"}`} style={{ left: pct(t), height: "18px" }} />}
            </div>
            <div className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
              <span className={off ? "text-warn" : "text-muted"}>{sentence}</span>
              {off && <Chip tone="warn">{st === "lower" ? "Lower" : "Higher"}</Chip>}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
