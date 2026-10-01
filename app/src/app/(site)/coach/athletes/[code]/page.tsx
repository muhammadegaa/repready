import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { removeAthlete, toggleProtected } from "@/actions/coach";
import { CopyButton } from "@/components/CopyButton";
import { Heat } from "@/components/Heat";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btnGhost, Card, Chip, Eyebrow } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { ago, dateLabel, decisionCopy } from "@/lib/copy";
import { todayStr } from "@/lib/run-agent";
import { getPulse } from "@/lib/store";
import { athleteDetail, STATUS, statusOf } from "@/lib/views";
import { providerName } from "@/lib/wearables";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/coach/athletes/[code]">) {
  const { code } = await props.params;
  return { title: `Athlete ${code.slice(0, 4)}` };
}

const OUTCOME = {
  pending: { label: "Waiting for you", tone: "warn" },
  approved: { label: "Sent", tone: "marker" },
  rejected: { label: "Kept plan", tone: "ok" },
  no_change: { label: "No change", tone: "ok" },
  error: { label: "No proposal", tone: "bad" },
} as const;

export default async function AthletePageForCoach(props: PageProps<"/coach/athletes/[code]">) {
  if ((await getRole()) !== "coach") redirect("/signin");
  const { code } = await props.params;
  const today = todayStr();
  const [d, pulse] = await Promise.all([athleteDetail(code, today), getPulse("coach")]);
  if (!d) notFound();
  const { athlete, days, proposals, todaySession, exerciseNames, wearable, events } = d;
  const todays = proposals.find((p) => p.on_date === today) ?? null;
  const todayDay = days[days.length - 1];
  const status = STATUS[statusOf(athlete, todaySession, todayDay.sleep !== null || todayDay.soreness !== null ? new Date(0).toISOString() : null, todays)];

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <div>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{athlete.name}</h1>
            <Chip tone={status.tone}>{status.label}</Chip>
          </div>
          <div className="flex items-center gap-2"><CopyButton path={`/a/${athlete.code}`} className={btnGhost} /></div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {athlete.consented_at ? `Joined ${ago(athlete.consented_at)}` : "Has not opened their link yet"}
          {wearable ? ` · ${providerName(wearable.provider)} connected` : ""}
        </p>
      </div>

      {todaySession && todays && (
        <section className="space-y-3">
          <Eyebrow>Today</Eyebrow>
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{decisionCopy(todays.decision).title}</div>
                {todays.reason && <p className="mt-0.5 text-sm text-muted">{todays.reason}</p>}
              </div>
              <Chip tone={OUTCOME[todays.status].tone}>{OUTCOME[todays.status].label}</Chip>
            </div>
            <SessionTable planned={todaySession.exercises} edits={todays.status === "approved" ? todays.edits : todays.edits} />
            {todays.coach_note && <p className="text-sm"><span className="text-muted">Your note:</span> {todays.coach_note}</p>}
            {todays.status === "pending" && <p className="text-sm text-muted">Decide on the <Link href="/coach" className="underline underline-offset-4">Today</Link> screen.</p>}
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <Eyebrow>Last 14 days</Eyebrow>
        <Card className="p-5"><Heat days={days} /></Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>Protected exercises</Eyebrow>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-muted">The agent never edits a protected exercise. Use this for an athlete who is managing something, then lift it when you clear them.</p>
          {exerciseNames.length === 0 ? (
            <p className="text-sm text-muted">Import a program to choose from its exercises.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {exerciseNames.map((n) => {
                const on = athlete.protected.includes(n);
                return (
                  <form key={n} action={toggleProtected}>
                    <input type="hidden" name="code" value={athlete.code} />
                    <input type="hidden" name="exercise" value={n} />
                    <button
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition ${on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:bg-paper"}`}
                    >
                      {on ? "Protected · " : ""}{n}
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>History</Eyebrow>
        <Card className="divide-y divide-line">
          {proposals.length === 0 && <p className="px-5 py-4 text-sm text-muted">No proposals yet.</p>}
          {proposals.map((p) => (
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm"><span className="font-medium">{dateLabel(p.on_date)}</span> · {decisionCopy(p.decision).title}{p.rules_applied.length ? <span className="font-mono text-xs text-muted"> · {p.rules_applied.join(", ")}</span> : null}</div>
                {p.reason && <p className="mt-0.5 text-sm text-muted">{p.reason}</p>}
                {p.coach_note && <p className="mt-0.5 text-sm">Note: {p.coach_note}</p>}
                {p.edited_by_coach && <p className="mt-0.5 text-xs text-muted">You changed the numbers before sending.</p>}
              </div>
              <Chip tone={OUTCOME[p.status].tone}>{OUTCOME[p.status].label}</Chip>
            </div>
          ))}
        </Card>
      </section>

      {events.length > 0 && (
        <section className="space-y-3">
          <Eyebrow>Activity</Eyebrow>
          <Card className="divide-y divide-line">
            {events.map((e) => (
              <div key={e.id} className="flex justify-between gap-4 px-5 py-2.5 text-sm"><span>{e.text}</span><span className="shrink-0 font-mono text-[11px] text-muted">{ago(e.at)}</span></div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <details className="rounded-xl border border-line bg-surface">
          <summary className="disclosure cursor-pointer px-5 py-3.5 text-sm font-medium text-muted hover:text-ink">Remove this athlete</summary>
          <form action={removeAthlete} className="flex flex-wrap items-center gap-4 border-t border-line px-5 py-4">
            <input type="hidden" name="code" value={athlete.code} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required />Delete {athlete.name} and every check-in, proposal and device reading. This cannot be undone.</label>
            <PendingButton className={btnGhost} pending="Deleting…">Delete</PendingButton>
          </form>
        </details>
      </section>
    </div>
  );
}
