import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { dateLabel } from "@/lib/copy";
import { groupLabel } from "@/lib/groups";
import type { Level } from "@/lib/squadmap";
import { squadMap, type MapRow } from "@/lib/views";

const FILL: Record<Level, string> = {
  none: "border border-dashed border-line",
  building: "bg-line/60",
  usual: "bg-ok/25",
  watch: "bg-warn/55",
  off: "bg-bad/80 text-paper",
};
const LABEL: Record<Level, string> = { none: "no answer", building: "not enough days yet to know their usual", usual: "within their usual", watch: "one measure outside their usual", off: "two or more outside their usual" };
const ORDER: Record<Level, number> = { off: 0, watch: 1, none: 2, usual: 3, building: 4 };
const GRID = "grid grid-cols-[minmax(150px,1.6fr)_repeat(14,minmax(0,1fr))_64px] items-center gap-1";

function Row({ r, dates, fixtures }: { r: MapRow; dates: string[]; fixtures: string[] }) {
  return (
    <div className={GRID}>
      <Link href={`/coach/athletes/${r.athlete.code}`} className="flex min-w-0 items-center gap-2 py-0.5 text-sm hover:underline">
        <span className="w-5 shrink-0 text-right font-mono text-[11px] text-muted">{r.athlete.shirt ?? ""}</span>
        <span className="truncate font-medium">{r.athlete.name}</span>
        {r.athlete.sample && <span className="shrink-0 text-[10px] text-muted">sample</span>}
        {r.hasOverride && <span title="Has a standing change to their plan" className="shrink-0 text-xs text-muted">◆</span>}
        {r.trend === "worse" && <span title="The last three days are clearly worse than the three before" className="shrink-0 text-xs text-bad">↘</span>}
        {r.trend === "quiet" && <span title="No answers for three days" className="shrink-0 text-[10px] text-muted">quiet</span>}
      </Link>
      {r.cells.map((c, i) => (
        <span
          key={dates[i]}
          title={`${r.athlete.name}, ${dateLabel(dates[i])}: ${LABEL[c.level]}${c.notes.length ? `. ${c.notes.join("; ")}` : ""}${r.minutes[i] !== null ? `. Played ${r.minutes[i]} min` : ""}${r.flagged[i] ? ". Flagged for you" : ""}`}
          className={`relative flex h-7 items-center justify-center rounded-[4px] font-mono text-[10px] tabular-nums ${FILL[c.level]} ${fixtures.includes(dates[i]) ? "ring-2 ring-brand/50" : ""}`}
        >
          {r.minutes[i] !== null ? r.minutes[i] : ""}
          {r.flagged[i] && <span className="absolute right-0.5 top-0 text-[11px] font-bold leading-none text-bad">!</span>}
        </span>
      ))}
      <span className="text-right font-mono text-[11px] tabular-nums text-muted" title="Minutes played in these two weeks">{r.minutesTotal > 0 ? `${r.minutesTotal}′` : ""}</span>
    </div>
  );
}

export async function SquadMapView({ club, today }: { club: string; today: string }) {
  const { dates, fixtures, rows, share } = await squadMap(club, today);
  const groups = [...new Set(rows.map((r) => r.athlete.group ?? ""))].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const needLook = rows.filter((r) => r.now === "off" || r.now === "watch").length;
  const quiet = rows.filter((r) => r.trend === "quiet").length;

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted">Everyone, the last two weeks. Each square is that player&apos;s day against <b>their own</b> usual, not against the squad. Players who need a look are at the top of each group.</p>

      {rows.length === 0 ? (
        <Card className="px-5 py-6 text-sm text-muted">Add players in Squad and the map fills in as they check in.</Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><b className="tabular-nums">{needLook}</b> outside their usual today</span>
            <span><b className="tabular-nums">{rows.filter((r) => r.trend === "worse").length}</b> trending down</span>
            <span><b className="tabular-nums">{quiet}</b> quiet for three days</span>
          </div>

          <Card className="overflow-x-auto p-4">
            <div className="min-w-[760px] space-y-1">
              <div className={`${GRID} font-mono text-[10px] text-muted`}>
                <span />
                {dates.map((d) => <span key={d} className={`text-center ${d === today ? "font-bold text-ink" : ""}`}>{Number(d.slice(8))}{fixtures.includes(d) ? <span className="block text-[9px] text-ink">M</span> : <span className="block text-[9px]">&nbsp;</span>}</span>)}
                <span className="text-right">min</span>
              </div>
              <div className={GRID}>
                <span className="text-xs font-medium text-muted">Squad off their usual</span>
                {share.map((s, i) => (
                  <span key={dates[i]} title={`${dateLabel(dates[i])}: ${s.off} of ${s.answered} who answered were outside their usual`} className="flex h-7 items-end rounded-[4px] bg-line/40">
                    <span className="w-full rounded-[4px] bg-warn/70" style={{ height: `${s.answered ? Math.max(8, Math.round((s.off / s.answered) * 100)) : 0}%` }} />
                  </span>
                ))}
                <span />
              </div>
              {groups.map((g) => (
                <div key={g || "all"} className="space-y-1 pt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{g ? groupLabel(g) : "Everyone"}</div>
                  {rows.filter((r) => (r.athlete.group ?? "") === g).sort((a, b) => ORDER[a.now] - ORDER[b.now] || a.athlete.name.localeCompare(b.athlete.name)).map((r) => <Row key={r.athlete.code} r={r} dates={dates} fixtures={fixtures} />)}
                </div>
              ))}
            </div>
          </Card>

          <section className="space-y-2">
            <Eyebrow>How to read it</Eyebrow>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              {(["usual", "watch", "off", "none", "building"] as Level[]).map((l) => (
                <span key={l} className="flex items-center gap-1.5"><span className={`inline-block h-3.5 w-3.5 rounded-[3px] ${FILL[l]}`} />{LABEL[l]}</span>
              ))}
              <span>Number in a square: minutes played</span>
              <span>Outlined square: match day</span>
              <span><b className="text-bad">!</b> flagged for you</span>
              <span>◆ standing plan change</span>
            </div>
            <p className="max-w-2xl text-xs text-muted">A square compares that day with the same player&apos;s other days: sleep lower than usual, soreness or stress higher. Better than usual is never marked. It describes; it does not change anyone&apos;s session.</p>
          </section>
        </>
      )}
    </div>
  );
}
