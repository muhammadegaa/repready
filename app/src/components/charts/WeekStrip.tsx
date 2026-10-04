import { revealStyle } from "@/lib/motion";

export type WeekDay = { date: string; label: string; md: string | null; match: boolean; sessions: number; today: boolean };

// The week around the match: which days are gym, which is the match, and how far each day is from it.
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const alt = days.map((d) => `${d.label}${d.match ? " match" : d.sessions ? ` ${d.sessions} gym session${d.sessions === 1 ? "" : "s"}` : " nothing planned"}`).join(", ");
  return (
    <div role="img" aria-label={`This week: ${alt}`} className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((d, i) => (
        <div key={d.date} className="min-w-0 space-y-1.5">
          <div className={`text-center font-mono text-[11px] ${d.today ? "font-semibold text-brand" : "text-muted"}`}>{d.label}</div>
          <div className="h-3.5 text-center font-mono text-[10px] text-brand">{d.md ?? ""}</div>
          <div
            style={revealStyle(i)}
            className={`reveal flex h-12 items-center justify-center rounded-lg px-1 text-center text-xs font-semibold ${d.today ? "ring-2 ring-brand/40" : ""} ${d.match ? "bg-ink text-paper" : d.sessions ? "border border-brand/30 bg-brand-soft text-brand-ink" : "border border-dashed border-line text-muted"}`}
          >
            {d.match ? "Match" : d.sessions ? (d.sessions > 1 ? `Gym ×${d.sessions}` : "Gym") : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
