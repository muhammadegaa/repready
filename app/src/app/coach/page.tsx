import { coachEnabled, isCoach } from "@/lib/coach-auth";
import { describeEdit } from "@/lib/agent/apply";
import { todayStr } from "@/lib/run-agent";
import { countSessions, getNotice, getReadiness, listAthletes, listProposals, type ProposalRow, type ReadinessRow } from "@/lib/store";
import { providerName } from "@/lib/wearables";
import { addAthlete, coachLogin, coachLogout, decide, importProgram } from "../actions";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-line bg-card px-3 py-2 outline-none focus:border-accent";
const btn = "rounded-md bg-accent px-4 py-2 text-sm font-medium text-[#f4f2ec] hover:opacity-90 dark:text-[#111210]";
const ghost = "rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-card";

const EXAMPLE = `date,label,week_type,exercise,sets,reps,load,target_rpe
${todayStr()},Lower strength,normal,Back squat,4,5,85% 1RM,8
${todayStr()},Lower strength,normal,Romanian deadlift,3,8,70% 1RM,7
${todayStr()},Lower strength,normal,Split squat,3,8,RPE 7,7`;

const statusLabel: Record<ProposalRow["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Kept plan",
  no_change: "No change",
  error: "Needs a look",
};

export default async function Coach() {
  if (!coachEnabled()) {
    return (
      <main className="py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Coach</h1>
        <p className="mt-3 text-muted">Set COACH_PASSCODE in app/.env.local and restart to use this page.</p>
      </main>
    );
  }
  if (!(await isCoach())) {
    return (
      <main className="mx-auto max-w-sm py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Coach sign in</h1>
        <p className="mt-2 text-sm text-muted">For the person who writes the program.</p>
        <form action={coachLogin} className="mt-6 space-y-3">
          <label htmlFor="passcode" className="block text-sm font-medium">Passcode</label>
          <input id="passcode" name="passcode" type="password" required autoFocus className={input} />
          <button className={`${btn} w-full py-2.5`}>Sign in</button>
        </form>
      </main>
    );
  }

  const [athletes, proposals, importError, sessionCount] = await Promise.all([listAthletes(), listProposals(60), getNotice("import"), countSessions()]);
  const today = todayStr();
  const wearables = new Map(await Promise.all(athletes.map(async (a) => [a.code, await getReadiness(a.code, today)] as const)));
  const pending = proposals.filter((p) => p.status === "pending");
  const rest = proposals.filter((p) => p.status !== "pending");

  return (
    <main className="space-y-12 py-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-muted">{pending.length === 0 ? "Nothing is waiting on you." : `${pending.length} proposal${pending.length === 1 ? "" : "s"} to decide.`}</p>
        </div>
        <form action={coachLogout}><button className={ghost}>Sign out</button></form>
      </header>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">To review</h2>
        {pending.length === 0 && <p className="mt-3 rounded-lg border border-line bg-card px-4 py-5 text-sm text-muted">Nothing waiting. Proposals appear here after athletes check in.</p>}
        <div className="mt-3 space-y-3">
          {pending.map((p) => <ProposalCard key={p.id} p={p} actions />)}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Athletes</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {athletes.map((a) => {
            const w = wearables.get(a.code);
            return (
              <li key={a.code} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                <div>
                  <span className="font-medium">{a.name}</span>
                  <span className="ml-2 text-sm text-muted">{a.consented_at ? "Ready" : "Waiting on consent"}</span>
                  {w && <p className="mt-0.5 text-sm text-muted"><WearableLine w={w} /></p>}
                </div>
                <a href={`/a/${a.code}`} className="text-sm text-accent">Open their page</a>
              </li>
            );
          })}
          {athletes.length === 0 && <li className="py-3 text-sm text-muted">No athletes yet.</li>}
        </ul>
        <form action={addAthlete} className="mt-3 flex gap-2">
          <label htmlFor="athlete-name" className="sr-only">Athlete name</label>
          <input id="athlete-name" name="name" placeholder="Athlete name" required maxLength={80} className={input} />
          <button className={btn}>Add</button>
        </form>
      </section>

      <section>
        <details className="group" {...(sessionCount === 0 ? { open: true } : {})}>
          <summary className="cursor-pointer text-sm font-medium uppercase tracking-[0.14em] text-muted">
            Program · {sessionCount} session{sessionCount === 1 ? "" : "s"} loaded
          </summary>
          <p className="mt-3 text-sm text-muted">Pasting a new program replaces all sessions. One program applies to every athlete.</p>
          {importError && <pre className="mt-3 whitespace-pre-wrap rounded-md border border-red-300 p-3 text-sm text-red-700 dark:border-red-900 dark:text-red-300">{importError}</pre>}
          <form action={importProgram} className="mt-3 space-y-3">
            <label htmlFor="csv" className="block text-sm font-medium">CSV</label>
            <textarea id="csv" name="csv" rows={7} defaultValue={EXAMPLE} className={`${input} font-mono text-sm`} />
            <button className={btn}>Import program</button>
          </form>
        </details>
      </section>

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Decisions</h2>
        <div className="mt-3 space-y-3">
          {rest.length === 0 && <p className="text-sm text-muted">No decisions yet.</p>}
          {rest.map((p) => <ProposalCard key={p.id} p={p} />)}
        </div>
      </section>
    </main>
  );
}

function WearableLine({ w }: { w: ReadinessRow }) {
  return (
    <>
      {providerName(w.provider)}
      {w.sleep_h != null ? ` · ${w.sleep_h}h sleep` : ""}
      {w.hrv_ms != null ? ` · HRV ${w.hrv_ms}` : ""}
    </>
  );
}

function ProposalCard({ p, actions }: { p: ProposalRow; actions?: boolean }) {
  const edits = p.edits;
  const rules = p.rules_applied;
  return (
    <article className="rounded-lg border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-medium">{p.athlete_name}</h3>
          <p className="text-sm text-muted">{p.on_date} · {p.session_label}</p>
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{statusLabel[p.status]}</span>
      </div>
      {p.decision && (
        <p className="mt-3 text-sm">
          <span className="font-medium capitalize">{p.decision.replace("_", " ")}</span>
          {rules.length ? <span className="text-muted"> · {rules.join(", ")}</span> : null}
        </p>
      )}
      {p.reason && <p className="mt-1 text-sm leading-relaxed">{p.reason}</p>}
      {edits.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          {edits.map((e, i) => <li key={i}>{describeEdit(e)}</li>)}
        </ul>
      )}
      {p.flag && <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm leading-relaxed">For you: {p.flag}</p>}
      {p.error && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{p.error}</p>}
      {actions && (
        <form action={decide} className="mt-4 flex gap-2">
          <input type="hidden" name="id" value={p.id} />
          <button name="intent" value="approve" className={btn}>Approve</button>
          <button name="intent" value="reject" className={ghost}>Keep the plan</button>
        </form>
      )}
    </article>
  );
}
