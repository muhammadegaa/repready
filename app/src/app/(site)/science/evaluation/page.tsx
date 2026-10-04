import Link from "next/link";
import { EvalRunner } from "@/components/EvalRunner";
import { Live } from "@/components/Live";
import { Card, Chip, Eyebrow, Notice, Stat, btn } from "@/components/ui";
import { PASS_DO_NOTHING, PASS_OVERALL } from "@/lib/agent/score";
import { requirePage } from "@/lib/auth";
import { ago } from "@/lib/copy";
import { activeRules, allRules, rulesHash } from "@/lib/rules";
import { SCENARIOS } from "@/lib/scenarios";
import { getPulse, listEvalRuns, listLabels } from "@/lib/store";

export const metadata = { title: "Evaluation" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

export default async function Evaluation() {
  const { club } = await requirePage("scientist");
  const [labels, runs, rules, pulse] = await Promise.all([listLabels(club), listEvalRuns(club, 8), allRules(club), getPulse(club, "science")]);
  const labeled = new Map(labels.map((l) => [l.id, l]));
  const last = runs[0] ?? null;
  const results = new Map((last?.results ?? []).map((r) => [r.id, r]));
  const stale = last && last.rules_hash !== rulesHash(activeRules(rules));
  const passOverall = last?.agreement != null && last.agreement >= PASS_OVERALL;
  const passNone = last?.do_nothing_agreement == null || last.do_nothing_agreement >= PASS_DO_NOTHING;
  const MIN_LABELS = 20;
  const enough = last !== null && last.labeled >= MIN_LABELS;
  const next = SCENARIOS.find((s) => !labeled.has(s.id));
  const ids = SCENARIOS.filter((s) => labeled.has(s.id)).map((s) => s.id);

  return (
    <div className="space-y-8">
      <Live scope="science" initial={pulse} />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Evaluation</h1>
        <p className="max-w-2xl text-muted">This checks whether the rules make the same call you would. You decide what you would do for {SCENARIOS.length} made-up players, then the rules decide the same {SCENARIOS.length}, and the page shows how often they agree.</p>
      </header>

      <Card className="space-y-4 p-5">
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="font-mono text-muted">1</span>
            <div className="space-y-1">
              <p className="font-medium">Decide each scenario yourself ({labeled.size} of {SCENARIOS.length} done)</p>
              <p className="text-muted">Open a scenario, pick what you would do as the coach, and save. Do this before you open the rule tags, so the rules do not sway you. Twenty is the minimum for a verdict.</p>
              {next && <Link href={`/science/label/${next.id}`} className={btn}>{labeled.size === 0 ? "Start with the first scenario" : "Next undecided scenario"}</Link>}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-muted">2</span>
            <div className="space-y-1">
              <p className="font-medium">Run the rules on them</p>
              <p className="text-muted">It takes a second and costs nothing. Run it again whenever you change a rule.</p>
              <EvalRunner ids={ids} disabledReason="Decide at least one scenario first." />
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-muted">3</span>
            <div className="space-y-1">
              <p className="font-medium">Read the result</p>
              <p className="text-muted">Agreement should reach {PASS_OVERALL}%, and {PASS_DO_NOTHING}% on the “no change” cases, where you would leave the session alone. Open a ✗ row below to see where you and the rules differ. On the Rules page, Delete switches a rule off, which changes the result. A threshold change needs a code change, so write it down and raise it with us.</p>
            </div>
          </li>
        </ol>
        <p className="border-t border-line pt-3 text-xs text-muted">Held-out scenarios are the final exam. Decide them like the others, but do not change any rule because of how they score. Otherwise the final check no longer tells you anything.</p>
      </Card>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Decided by you" value={`${labeled.size}/${SCENARIOS.length}`} hint="need 20" />
        <Stat label="Agreement" value={pct(last?.agreement ?? null)} hint={`pass at ${PASS_OVERALL}%`} />
        <Stat label="No-change cases" value={pct(last?.do_nothing_agreement ?? null)} hint={`pass at ${PASS_DO_NOTHING}%`} />
        <Stat label="Held out" value={pct(last?.holdout_agreement ?? null)} hint="final exam" />
      </section>

      {last && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="text-sm">
            <span className="font-medium">Last run {ago(last.at)}</span>
            <span className="text-muted"> · rules {last.rules_hash} · {last.labeled} scored</span>
          </div>
          {!enough ? <Chip>Decide {MIN_LABELS} scenarios for a verdict</Chip> : passOverall && passNone ? <Chip tone="ok">Meets the bar</Chip> : <Chip tone="warn">Below the bar</Chip>}
        </Card>
      )}
      {stale && <Notice>You changed the rules since that run, so these numbers are out of date. Run it again in step 2.</Notice>}

      <section className="space-y-3">
        <Eyebrow>Scenarios</Eyebrow>
        <Card className="divide-y divide-line">
          {SCENARIOS.map((s) => {
            const l = labeled.get(s.id);
            const r = results.get(s.id);
            return (
              <Link key={s.id} href={`/science/label/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition hover:bg-paper">
                <span className="w-10 font-mono text-xs text-muted">{s.id}</span>
                <span className="min-w-40 flex-1 text-sm"><span className="font-medium">{s.athlete.sport}</span><span className="text-muted"> · {s.planned_session.label}</span></span>
                {s.holdout && <Chip>Held out</Chip>}
                <span className="w-44 text-sm">{l ? <span><span className="text-muted">You:</span> {l.decision.replace("_", " ")}</span> : <span className="text-muted">Not decided yet</span>}</span>
                <span className="w-44 text-sm">
                  {r ? (r.error ? <Chip tone="bad">Error</Chip> : <span className={r.agree ? "text-ok" : r.agree === false ? "text-bad" : "text-muted"}>{r.agree ? "✓" : r.agree === false ? "✗" : ""} Rules: {r.decision?.replace("_", " ")}</span>) : <span className="text-muted">Not run</span>}
                </span>
              </Link>
            );
          })}
        </Card>
      </section>

      {runs.length > 1 && (
        <section className="space-y-3">
          <Eyebrow>Earlier runs</Eyebrow>
          <Card className="divide-y divide-line">
            {runs.slice(1).map((r) => (
              <div key={r.id} className="flex flex-wrap justify-between gap-3 px-5 py-3 text-sm">
                <span>{ago(r.at)} <span className="text-muted">· rules {r.rules_hash}</span></span>
                <span className="font-mono tabular-nums">{pct(r.agreement)} · no-change {pct(r.do_nothing_agreement)} · held out {pct(r.holdout_agreement)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
