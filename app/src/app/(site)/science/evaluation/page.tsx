import Link from "next/link";
import { redirect } from "next/navigation";
import { EvalRunner } from "@/components/EvalRunner";
import { Live } from "@/components/Live";
import { Card, Chip, Eyebrow, Notice, Stat } from "@/components/ui";
import { PASS_DO_NOTHING, PASS_OVERALL } from "@/lib/agent/score";
import { getRole } from "@/lib/auth";
import { ago } from "@/lib/copy";
import { activeRules, allRules, rulesHash } from "@/lib/rules";
import { SCENARIOS } from "@/lib/scenarios";
import { getPulse, listEvalRuns, listLabels } from "@/lib/store";

export const metadata = { title: "Evaluation" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const pct = (v: number | null) => (v === null ? "–" : `${v}%`);

export default async function Evaluation() {
  if ((await getRole()) !== "scientist") redirect("/signin");
  const [labels, runs, rules, pulse] = await Promise.all([listLabels(), listEvalRuns(8), allRules(), getPulse("science")]);
  const labeled = new Map(labels.map((l) => [l.id, l]));
  const last = runs[0] ?? null;
  const results = new Map((last?.results ?? []).map((r) => [r.id, r]));
  const stale = last && last.rules_hash !== rulesHash(activeRules(rules));
  const passOverall = last?.agreement != null && last.agreement >= PASS_OVERALL;
  const passNone = last?.do_nothing_agreement == null || last.do_nothing_agreement >= PASS_DO_NOTHING;
  const MIN_LABELS = 20;
  const enough = last !== null && last.labeled >= MIN_LABELS;
  const ids = SCENARIOS.filter((s) => labeled.has(s.id)).map((s) => s.id);

  return (
    <div className="space-y-8">
      <Live scope="science" initial={pulse} />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Evaluation</h1>
        <p className="max-w-2xl text-muted">The agent is scored against your decisions on {SCENARIOS.length} fictional players. It passes at {PASS_OVERALL}% agreement overall and {PASS_DO_NOTHING}% on the “no change” cases. Scenarios marked held out are for the final check only: do not tune the rules or prompt against them.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Labeled" value={`${labeled.size}/${SCENARIOS.length}`} hint="by you" />
        <Stat label="Agreement" value={pct(last?.agreement ?? null)} hint={`pass at ${PASS_OVERALL}%`} />
        <Stat label="No-change cases" value={pct(last?.do_nothing_agreement ?? null)} hint={`pass at ${PASS_DO_NOTHING}%`} />
        <Stat label="Held out" value={pct(last?.holdout_agreement ?? null)} hint="final check" />
      </section>

      {last && (
        <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="text-sm">
            <span className="font-medium">Last run {ago(last.at)}</span>
            <span className="text-muted"> · {last.model} · rules {last.rules_hash} · {last.labeled} scored</span>
          </div>
          {!enough ? <Chip>Needs {MIN_LABELS} labels for a verdict</Chip> : passOverall && passNone ? <Chip tone="ok">Meets the bar</Chip> : <Chip tone="warn">Below the bar</Chip>}
        </Card>
      )}
      {stale && <Notice>The rules changed since that run. Run the evaluation again.</Notice>}

      <section className="space-y-3">
        <Eyebrow>Run</Eyebrow>
        <Card className="p-5">
          <EvalRunner ids={ids} disabledReason="Label at least one scenario first." />
          <p className="mt-3 text-xs text-muted">Each scenario is one model call. The run takes about a minute for thirty.</p>
        </Card>
      </section>

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
                <span className="w-44 text-sm">{l ? <span><span className="text-muted">You:</span> {l.decision.replace("_", " ")}</span> : <span className="text-muted">Not labeled</span>}</span>
                <span className="w-44 text-sm">
                  {r ? (r.error ? <Chip tone="bad">Error</Chip> : <span className={r.agree ? "text-ok" : r.agree === false ? "text-bad" : "text-muted"}>{r.agree ? "✓" : r.agree === false ? "✗" : ""} Agent: {r.decision?.replace("_", " ")}</span>) : <span className="text-muted">Not run</span>}
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
                <span>{ago(r.at)} <span className="text-muted">· {r.model} · rules {r.rules_hash}</span></span>
                <span className="font-mono tabular-nums">{pct(r.agreement)} · no-change {pct(r.do_nothing_agreement)} · held out {pct(r.holdout_agreement)}</span>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
