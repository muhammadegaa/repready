import Link from "next/link";
import { Card, Eyebrow } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { summarise } from "@/lib/results";
import { addDays } from "@/lib/read/program";
import { todayStr } from "@/lib/run-agent";
import { checkinCodesSince, listAthletes, listProposals } from "@/lib/store";

export const metadata = { title: "Results" };
export const dynamic = "force-dynamic";

const DAYS = 14;
const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm">{label}</div>
      {note && <div className="mt-0.5 text-xs text-muted">{note}</div>}
    </Card>
  );
}

export default async function Results() {
  const { club } = await requirePage("coach");
  const from = addDays(todayStr(), -(DAYS - 1));
  const [athletes, codes, proposals] = await Promise.all([listAthletes(club), checkinCodesSince(club, from), listProposals(club, 500)]);
  // Fictional sample players never count towards a club's own numbers.
  const real = new Set(athletes.filter((a) => a.approved && !a.sample).map((a) => a.code));
  const r = summarise({
    days: DAYS,
    players: real.size,
    checkins: codes.filter((c) => real.has(c)).length,
    proposals: proposals.filter((p) => real.has(p.athlete_code) && p.on_date >= from),
  });

  return (
    <div className="space-y-8">
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Results</h1>
        <p className="mt-1 max-w-2xl text-muted">The last {DAYS} days, for your own players only. Two questions: do players answer, and do you act on what the rules suggest?</p>
      </header>
      {r.players === 0 ? (
        <Card className="px-5 py-6 text-sm text-muted">Add your players and run a few days. Sample players are not counted.</Card>
      ) : (
        <>
          <section className="space-y-3">
            <Eyebrow>Do players answer?</Eyebrow>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Check-in rate" value={pct(r.checkinRate)} note={`${r.checkins} answers out of ${r.possible} possible (${r.players} players × ${r.days} days)`} />
            </div>
          </section>
          <section className="space-y-3">
            <Eyebrow>Do you act on the suggestions?</Eyebrow>
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Suggestions made" value={String(r.suggestions)} note={r.pending ? `${r.pending} still waiting for you` : undefined} />
              <Stat label="Approved" value={String(r.approved)} note={r.changedByCoach ? `${r.changedByCoach} with your own changes` : undefined} />
              <Stat label="Kept the plan" value={String(r.keptPlan)} />
              <Stat label="Median time to decide" value={r.medianHoursToDecide === null ? "n/a" : `${r.medianHoursToDecide} h`} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
