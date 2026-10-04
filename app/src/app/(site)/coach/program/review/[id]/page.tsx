import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { applyDraft, discardDraft, fixDraft, reviseDraft } from "@/actions/program";
import { PendingButton } from "@/components/Pending";
import { btn, Card, Chip, Eyebrow, input } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { dateLabel } from "@/lib/copy";
import { groupLabel } from "@/lib/groups";
import { blocking, issuesOf } from "@/lib/read/program";
import { todayStr } from "@/lib/run-agent";
import { getDraft } from "@/lib/store";

export const metadata = { title: "Check your program" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Review({ params, searchParams }: PageProps<"/coach/program/review/[id]">) {
  const { club } = await requirePage("coach");
  const { id } = await params;
  const q = await searchParams;
  const err = typeof q.err === "string" ? q.err.slice(0, 400) : null;
  const d = await getDraft(club, id);
  if (!d) notFound();
  if (d.status !== "open") redirect("/coach/program");

  const p = d.program;
  const issues = issuesOf(p, todayStr());
  const stop = blocking(issues).length > 0;

  return (
    <div className="space-y-8">
      <header>
        {d.origin === "today"
          ? <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
          : <Link href="/coach/program" className="text-sm text-muted hover:text-ink">← Program</Link>}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Check your program</h1>
        <p className="mt-1 max-w-2xl text-muted">This is what I read. Nothing has reached your players yet. Fix anything that is wrong, then use it.</p>
      </header>

      {err && <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{err}</div>}

      {(p.notes.length > 0 || issues.length > 0) && (
        <Card className="space-y-2 p-5">
          <Eyebrow>Worth a look</Eyebrow>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {issues.map((i, n) => <li key={`i${n}`} className={i.level === "blocking" ? "text-warn" : ""}>{i.text}</li>)}
            {p.notes.map((n, k) => <li key={`n${k}`} className="text-muted">{n}</li>)}
          </ul>
        </Card>
      )}

      <form action={fixDraft} className="space-y-4">
        <input type="hidden" name="id" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          {p.sessions.map((s, i) => (
            <Card key={i} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-muted">{s.date ? dateLabel(s.date) : "No date yet"}{s.day && !s.date ? ` (you wrote “${s.day}”)` : ""}</div>
                </div>
                <div className="flex gap-1.5">
                  {s.week_type === "deload" && <Chip tone="neutral">Deload</Chip>}
                  <Chip tone={s.group ? "marker" : "neutral"}>{s.group ? `Group: ${groupLabel(s.group)}` : "Everyone"}</Chip>
                </div>
              </div>
              <ul className="space-y-0.5 text-sm">
                {s.exercises.map((e, k) => <li key={k}>{e.name} <span className="text-muted">{e.sets}×{e.reps}{e.load ? `, ${e.load}` : ""}{e.target_rpe ? `, RPE ${e.target_rpe}` : ""}</span></li>)}
              </ul>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label htmlFor={`date_${i}`} className="text-muted">Date</label>
                <input id={`date_${i}`} name={`date_${i}`} type="date" defaultValue={s.date ?? ""} className={`${input} max-w-44`} />
                <label className="flex items-center gap-1.5 text-muted"><input type="checkbox" name={`drop_${i}`} value="yes" /> Leave this one out</label>
              </div>
            </Card>
          ))}
        </div>
        {p.sessions.length === 0 && <Card className="px-5 py-6 text-sm text-muted">I did not find any gym sessions in that. Discard it and try again with the exercises written out.</Card>}
        {p.sessions.length > 0 && <PendingButton className={btn} pending="Saving…">Update dates</PendingButton>}
      </form>

      <form action={reviseDraft} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <label htmlFor="instruction" className="block text-sm font-medium">Something wrong? Tell me in your own words</label>
        <input id="instruction" name="instruction" className={input} placeholder="Reserves also train on Tuesday. Make Friday a deload." />
        <PendingButton className={btn} pending="Changing…">Change it</PendingButton>
      </form>

      <div className="flex flex-wrap gap-3">
        <form action={applyDraft}>
          <input type="hidden" name="id" value={id} />
          {stop || p.sessions.length === 0
            ? <button type="button" disabled className={`${btn} opacity-50`}>Use this program</button>
            : <PendingButton className={btn} pending="Saving…">Use this program</PendingButton>}
        </form>
        <form action={discardDraft}>
          <input type="hidden" name="id" value={id} />
          <PendingButton className="text-sm text-muted underline underline-offset-4" pending="Discarding…">Discard</PendingButton>
        </form>
      </div>
    </div>
  );
}
