import Link from "next/link";
import { setAutopilotPaused, setDelegation } from "@/actions/coach";
import { PendingButton } from "@/components/Pending";
import { btn, btnGhost, Card, Chip, Eyebrow } from "@/components/ui";
import { MIN_DECISIONS, MIN_RATE, NEVER_AUTOMATIC, ruleStats, WINDOW_DAYS } from "@/lib/autonomy";
import { allRules } from "@/lib/rules";
import { requirePage } from "@/lib/auth";
import { summarise } from "@/lib/results";
import { addDays } from "@/lib/read/program";
import { todayStr } from "@/lib/run-agent";
import { checkinCodesSince, getAutonomy, listAthletes, listProposals } from "@/lib/store";

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

export default async function Results(props: PageProps<"/coach/results">) {
  const { autoerr } = await props.searchParams;
  const { club } = await requirePage("coach");
  const from = addDays(todayStr(), -(DAYS - 1));
  const [athletes, codes, proposals, rules, autonomy] = await Promise.all([listAthletes(club), checkinCodesSince(club, from), listProposals(club, 500), allRules(club), getAutonomy(club)]);
  const stats = ruleStats(proposals.filter((p) => !athletes.find((a) => a.code === p.athlete_code)?.sample), todayStr(), rules.map((r) => r.id));
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

      <section id="autonomy" className="space-y-3">
        <Eyebrow>How much the agent does for you</Eyebrow>
        <Card className="space-y-4 p-5">
          <ol className="space-y-1.5 text-sm">
            <li><b>1 · Suggest.</b> The agent proposes, you decide. Always on.</li>
            <li><b>2 · Approve together.</b> Routine trims are grouped on Today so you can approve them in one tap.</li>
            <li><b>3 · Handle it.</b> For a rule you choose, the agent applies routine trims itself and shows them under “Handled for you”, each one with a button to take it back.</li>
            <li className="text-muted"><b>Never automatic:</b> pain or illness notes, rest, “can’t train”, swaps, anything raised, anything the limits had to change, and any player you mark “always ask me”.</li>
          </ol>
          {typeof autoerr === "string" && <p className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{autoerr}</p>}
          <p className="text-sm text-muted">A rule can be handed over once it has earned it: at least {MIN_DECISIONS} of your decisions in the last {WINDOW_DAYS} days, with {Math.round(MIN_RATE * 100)} in 100 approved exactly as proposed.</p>
          <div className="divide-y divide-line rounded-md border border-line">
            {rules.filter((r) => r.keep !== "delete").map((r) => {
              const st = stats.find((x) => x.rule === r.id)!;
              const on = autonomy.delegated.includes(r.id);
              const never = NEVER_AUTOMATIC.has(r.id);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium"><span className="mr-2 font-mono text-xs text-muted">{r.id}</span>{r.name}</div>
                    <div className="text-xs text-muted">
                      {never ? "Always comes to you." : st.decided === 0 ? "No decisions yet." : `${st.decided} decided, ${st.asProposed} approved as proposed (${Math.round((st.rate ?? 0) * 100)}%).`}
                    </div>
                  </div>
                  {never ? <Chip tone="neutral">Never automatic</Chip> : on ? (
                    <form action={setDelegation} className="flex items-center gap-2"><Chip tone="ok">Agent handles it</Chip><input type="hidden" name="rule" value={r.id} /><input type="hidden" name="on" value="no" /><PendingButton className="text-sm text-muted underline underline-offset-4" pending="…">Stop</PendingButton></form>
                  ) : st.eligible ? (
                    <form action={setDelegation}><input type="hidden" name="rule" value={r.id} /><input type="hidden" name="on" value="yes" /><PendingButton className={btnGhost} pending="Saving…">Let the agent handle it</PendingButton></form>
                  ) : <Chip tone="neutral">{st.decided >= MIN_DECISIONS ? "Not yet: too many changed" : "Not enough history yet"}</Chip>}
                </div>
              );
            })}
          </div>
          <form action={setAutopilotPaused} className="flex items-center justify-between gap-3 text-sm">
            <span>{autonomy.paused ? "Paused: nothing is applied without you, whatever is switched on." : "Pause everything at once if you want every suggestion to come to you."}</span>
            <input type="hidden" name="paused" value={autonomy.paused ? "no" : "yes"} />
            <PendingButton className={autonomy.paused ? btn : btnGhost} pending="Saving…">{autonomy.paused ? "Resume" : "Pause all"}</PendingButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
