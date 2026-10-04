import { shares } from "@/lib/charts";
import { revealStyle } from "@/lib/motion";

const RUNGS = [
  { n: "1", title: "Suggest", text: "The agent proposes, you decide. Always on." },
  { n: "2", title: "Approve together", text: "Routine trims are grouped on Today for one approval." },
  { n: "3", title: "Handle it", text: "For a rule you hand over, the agent applies routine trims and you can take each back." },
];

// The three steps of how much the agent does, with the club's current step marked, and the one thing that is never automatic below.
export function Ladder({ handing }: { handing: string[] }) {
  const top = handing.length > 0 ? 2 : -1;
  return (
    <div className="space-y-2">
      <ol className="space-y-2">
        {RUNGS.map((r, i) => {
          const here = i === top;
          return (
            <li key={r.n} style={revealStyle(i)} className={`reveal grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${here ? "border-brand/40 bg-brand-soft" : "border-line bg-surface"}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${here ? "bg-brand text-on-brand" : "bg-paper text-muted ring-1 ring-line"}`}>{r.n}</span>
              <span>
                <b>{r.title}</b>{here && <span className="ml-2 text-xs text-brand-ink">on for {handing.join(", ")}</span>}
                <span className="block text-xs text-muted">{r.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div style={revealStyle(3)} className="reveal rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-xs text-muted"><b className="text-ink">Never automatic:</b> pain or illness notes, rest, “can’t train”, swaps, anything raised, anything the limits had to change, and any player you mark “always ask me”.</div>
    </div>
  );
}

// How often a rule's suggestions were approved exactly as proposed, with the line it has to reach to be handed over.
export function RecordBar({ decided, asProposed, need }: { decided: number; asProposed: number; need: number }) {
  const rate = decided === 0 ? 0 : asProposed / decided;
  return (
    <div className="mt-1.5 flex items-center gap-2" role="img" aria-label={decided === 0 ? "No decisions yet" : `${asProposed} of ${decided} approved as proposed; ${Math.round(need * 100)}% is needed`}>
      <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-line">
        <div className="grow-x h-full rounded-full bg-brand" style={{ width: `${rate * 100}%` }} />
        <span className="absolute top-0 h-full w-px bg-ink/50" style={{ left: `${need * 100}%` }} />
      </div>
    </div>
  );
}

// Approved, kept the plan, still waiting: one bar so the proportions are visible at once.
export function OutcomeBar({ approved, kept, waiting }: { approved: number; kept: number; waiting: number }) {
  const [a, k, w] = shares([approved, kept, waiting]);
  const total = approved + kept + waiting;
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${approved} approved, ${kept} kept the plan, ${waiting} waiting`}>
        {a > 0 && <div className="grow-x bg-brand" style={{ width: `${a}%` }} />}
        {k > 0 && <div className="grow-x bg-line-strong" style={{ width: `${k}%` }} />}
        {w > 0 && <div className="grow-x bg-warn" style={{ width: `${w}%` }} />}
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand" />Approved {approved}</span>
          <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-line-strong" />Kept the plan {kept}</span>
          {waiting > 0 && <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-warn" />Waiting {waiting}</span>}
        </div>
      )}
    </div>
  );
}
