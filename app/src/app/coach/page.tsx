import db from "@/lib/db";
import { coachEnabled, isCoach } from "@/lib/coach-auth";
import { describeEdit } from "@/lib/agent/apply";
import type { Edit } from "@/lib/agent/schema";
import { todayStr } from "@/lib/run-agent";
import { addAthlete, coachLogin, coachLogout, decide, importProgram } from "../actions";

export const dynamic = "force-dynamic";

type ProposalRow = {
  id: number; athlete: string; label: string | null; on_date: string; decision: string | null; edits: string;
  reason: string | null; rules_applied: string; flag: string | null; status: string; error: string | null;
};

const box = "rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";
const input = "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
const btn = "rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-neutral-950";
const ghost = "rounded-md border border-neutral-300 px-4 py-2 font-medium dark:border-neutral-700";

const EXAMPLE = `date,label,week_type,exercise,sets,reps,load,target_rpe
${todayStr()},Lower strength,normal,Back squat,4,5,85% 1RM,8
${todayStr()},Lower strength,normal,Romanian deadlift,3,8,70% 1RM,7
${todayStr()},Lower strength,normal,Split squat,3,8,RPE 7,7`;

export default async function Coach() {
  if (!coachEnabled()) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <p className="mt-3">Set COACH_PASSCODE in app/.env.local and restart to use this page.</p>
      </main>
    );
  }
  if (!(await isCoach())) {
    return (
      <main className="mx-auto max-w-sm p-6">
        <h1 className="text-2xl font-semibold">Coach sign in</h1>
        <form action={coachLogin} className="mt-4 space-y-3">
          <label htmlFor="passcode" className="block text-sm font-medium">Passcode</label>
          <input id="passcode" name="passcode" type="password" required className={input} />
          <button className={btn}>Sign in</button>
        </form>
      </main>
    );
  }

  const athletes = db.prepare("select id, name, code, consented_at from athlete order by id").all() as { id: number; name: string; code: string; consented_at: string | null }[];
  const proposals = db.prepare(
    `select p.id, a.name as athlete, s.label, p.on_date, p.decision, p.edits, p.reason, p.rules_applied, p.flag, p.status, p.error
     from proposal p join athlete a on a.id = p.athlete_id left join session s on s.id = p.session_id
     order by p.on_date desc, p.id desc limit 60`,
  ).all() as ProposalRow[];
  const pending = proposals.filter((p) => p.status === "pending");
  const rest = proposals.filter((p) => p.status !== "pending");
  const importError = (db.prepare("select v from notice where k = 'import'").get() as { v: string } | undefined)?.v;
  const sessionCount = (db.prepare("select count(*) as n from session").get() as { n: number }).n;

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <form action={coachLogout}><button className={ghost}>Sign out</button></form>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">To review ({pending.length})</h2>
        {pending.length === 0 && <p className="text-neutral-500">Nothing waiting. Proposals appear here after athletes check in.</p>}
        <div className="space-y-3">
          {pending.map((p) => <ProposalCard key={p.id} p={p} actions />)}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Athletes</h2>
        <ul className="space-y-2">
          {athletes.map((a) => (
            <li key={a.id} className={box}>
              <span className="font-medium">{a.name}</span>{" "}
              <span className="text-sm text-neutral-500">{a.consented_at ? "consented" : "not yet consented"}</span>
              <div className="mt-1 break-all font-mono text-sm">/a/{a.code}</div>
            </li>
          ))}
        </ul>
        <form action={addAthlete} className="mt-3 flex gap-2">
          <label htmlFor="athlete-name" className="sr-only">Athlete name</label>
          <input id="athlete-name" name="name" placeholder="Athlete name" required maxLength={80} className={input} />
          <button className={btn}>Add</button>
        </form>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Program</h2>
        <p className="mb-3 text-sm text-neutral-500">{sessionCount} sessions loaded. Pasting a new program replaces all sessions. One program applies to every athlete.</p>
        {importError && <pre className="mb-3 whitespace-pre-wrap rounded-md border border-red-300 p-3 text-sm text-red-700 dark:text-red-400">{importError}</pre>}
        <form action={importProgram} className="space-y-3">
          <label htmlFor="csv" className="block text-sm font-medium">CSV</label>
          <textarea id="csv" name="csv" rows={8} defaultValue={EXAMPLE} className={`${input} font-mono text-sm`} />
          <button className={btn}>Import program</button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        <div className="space-y-3">
          {rest.length === 0 && <p className="text-neutral-500">No decisions yet.</p>}
          {rest.map((p) => <ProposalCard key={p.id} p={p} />)}
        </div>
      </section>
    </main>
  );
}

function ProposalCard({ p, actions }: { p: ProposalRow; actions?: boolean }) {
  const edits = JSON.parse(p.edits) as Edit[];
  const rules = JSON.parse(p.rules_applied) as string[];
  return (
    <div className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div><span className="font-medium">{p.athlete}</span> <span className="text-sm text-neutral-500">{p.on_date} {p.label ?? "(session removed)"}</span></div>
        <span className="font-mono text-xs uppercase tracking-wide text-neutral-500">{p.status.replace("_", " ")}</span>
      </div>
      {p.decision && <p className="mt-2 text-sm"><span className="font-medium">{p.decision.replace("_", " ")}</span>{rules.length ? ` · ${rules.join(", ")}` : ""}</p>}
      {p.reason && <p className="mt-1">{p.reason}</p>}
      {edits.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{edits.map((e, i) => <li key={i}>{describeEdit(e)}</li>)}</ul>}
      {p.flag && <p className="mt-2 rounded-md border border-amber-400 p-2 text-sm">Flag for you: {p.flag}</p>}
      {p.error && <p className="mt-2 text-sm text-red-700 dark:text-red-400">{p.error}</p>}
      {actions && (
        <form action={decide} className="mt-3 flex gap-2">
          <input type="hidden" name="id" value={p.id} />
          <button name="intent" value="approve" className={btn}>Approve</button>
          <button name="intent" value="reject" className={ghost}>Reject</button>
        </form>
      )}
    </div>
  );
}
