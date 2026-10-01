import Link from "next/link";
import { redirect } from "next/navigation";
import { saveRuleAction } from "@/actions/science";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { btn, Card, Chip, Eyebrow, input, Notice } from "@/components/ui";
import { getRole, roleEnabled } from "@/lib/auth";
import { ago } from "@/lib/copy";
import { activeRules, allRules, rulesHash } from "@/lib/rules";
import { getPulse, listEvalRuns } from "@/lib/store";

export const metadata = { title: "Rules" };
export const dynamic = "force-dynamic";

const VERDICTS: [string, string][] = [["", "Not reviewed"], ["keep", "Keep"], ["change", "Changed"], ["delete", "Delete"]];

export default async function Rules() {
  if ((await getRole()) !== "scientist") redirect("/signin");
  const [rules, runs, pulse] = await Promise.all([allRules(), listEvalRuns(1), getPulse("science")]);
  const hash = rulesHash(activeRules(rules));
  const last = runs[0] ?? null;
  const stale = last && last.rules_hash !== hash;
  const reviewed = rules.filter((r) => r.keep).length;
  const cited = rules.filter((r) => r.evidence.trim()).length;

  return (
    <div className="space-y-8">
      <Live scope="science" initial={pulse} />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Rules</h1>
        <p className="max-w-2xl text-muted">The agent can only apply the rules on this page. Edits take effect on the next check-in for every coach, so cite the evidence and re-run the evaluation after you change anything.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3"><div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Reviewed</div><div className="mt-1 text-2xl font-semibold tabular-nums">{reviewed}/{rules.length}</div></Card>
        <Card className="px-4 py-3"><div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">With a citation</div><div className="mt-1 text-2xl font-semibold tabular-nums">{cited}/{rules.length}</div></Card>
        <Card className="px-4 py-3"><div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Last evaluation</div><div className="mt-1 text-2xl font-semibold tabular-nums">{last?.agreement != null ? `${last.agreement}%` : "None"}</div><div className="text-xs text-muted">{last ? ago(last.at) : "Run it on the Evaluation tab"}</div></Card>
      </div>

      {stale && <Notice>The rules changed since the last evaluation. <Link href="/science/evaluation" className="font-medium underline underline-offset-4">Run it again</Link> before you trust the score.</Notice>}

      <section className="space-y-4">
        <Eyebrow>Candidate rules</Eyebrow>
        <p className="text-sm text-muted">These ten were drafted by Claude as a starting point. Thresholds and actions are placeholders until you keep, change or delete each one.</p>
        {rules.map((r) => (
          <Card key={r.id} className="p-5">
            <form action={saveRuleAction} className="space-y-4">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-paper px-2 py-1 font-mono text-xs text-muted ring-1 ring-line">{r.id}</span>
                  <h3 className="font-semibold">{r.name}</h3>
                  {r.keep === "delete" && <Chip tone="bad">Deleted</Chip>}
                  {r.keep === "keep" && <Chip tone="ok">Kept</Chip>}
                  {r.keep === "change" && <Chip tone="marker">Changed</Chip>}
                  {!r.evidence.trim() && r.keep !== "delete" && <Chip tone="warn">No citation</Chip>}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`keep-${r.id}`} className="sr-only">Verdict for {r.id}</label>
                  <select id={`keep-${r.id}`} name="keep" defaultValue={r.keep ?? ""} className={`${input} w-40`}>
                    {VERDICTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor={`t-${r.id}`} className="block text-xs font-medium text-muted">When (trigger)</label>
                  <textarea id={`t-${r.id}`} name="trigger" rows={3} defaultValue={r.trigger} className={`${input} mt-1`} />
                </div>
                <div>
                  <label htmlFor={`a-${r.id}`} className="block text-xs font-medium text-muted">Then (action)</label>
                  <textarea id={`a-${r.id}`} name="action" rows={3} defaultValue={r.action} className={`${input} mt-1`} />
                </div>
              </div>
              <div>
                <label htmlFor={`e-${r.id}`} className="block text-xs font-medium text-muted">Evidence (citation)</label>
                <textarea id={`e-${r.id}`} name="evidence" rows={2} defaultValue={r.evidence} placeholder="Author, year, title, and what it supports" className={`${input} mt-1`} />
              </div>
              <div className="flex items-center gap-4">
                <PendingButton className={btn} pending="Saving…">Save {r.id}</PendingButton>
                {r.updated_at && <span className="text-xs text-muted">Saved {ago(r.updated_at)}</span>}
              </div>
            </form>
          </Card>
        ))}
        {!roleEnabled("scientist") && <Notice tone="bad">SCIENTIST_PASSCODE is not set.</Notice>}
      </section>
    </div>
  );
}
