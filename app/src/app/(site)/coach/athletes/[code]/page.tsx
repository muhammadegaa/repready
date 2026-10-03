import Link from "next/link";
import { notFound } from "next/navigation";
import { addPlanOverride, liftPlanOverride, removeAthlete, setPlayerGroup, toggleProtected } from "@/actions/coach";
import { CopyButton } from "@/components/CopyButton";
import { Heat } from "@/components/Heat";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btnGhost, Card, Chip, Eyebrow, input } from "@/components/ui";
import { groupLabel } from "@/lib/groups";
import { describeOverride, isActive } from "@/lib/overrides";
import { requirePage } from "@/lib/auth";
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
  const { club } = await requirePage("coach");
  const { code } = await props.params;
  const { overrideerr, overrideok } = await props.searchParams;
  const today = todayStr();
  const [d, pulse] = await Promise.all([athleteDetail(code, today), getPulse(club, "coach")]);
  if (!d || d.athlete.club !== club) notFound();
  const { athlete, days, proposals, todaySession, changed, overrides, exerciseNames, wearable, events } = d;
  const activeOverrides = overrides.filter((o) => isActive(o, today));
  const pastOverrides = overrides.filter((o) => !isActive(o, today)).slice(0, 5);
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
          <div className="flex items-center gap-2"><CopyButton path={`/a/${athlete.code}`} label="Copy player link" className={btnGhost} /></div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {athlete.consented_at ? `Joined ${ago(athlete.consented_at)}` : "Has not agreed to the terms yet"}
          {wearable ? ` · ${providerName(wearable.provider)} connected` : ""}
          {` · Group: ${groupLabel(athlete.group)}`}
        </p>
        <form action={setPlayerGroup} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="code" value={athlete.code} />
          <label htmlFor="group" className="text-sm text-muted">Group</label>
          <input id="group" name="group" defaultValue={athlete.group ?? ""} maxLength={30} placeholder="Everyone" className={`${input} max-w-56`} />
          <PendingButton className={btnGhost} pending="Saving…">Set group</PendingButton>
        </form>
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
            <SessionTable planned={todaySession.exercises} edits={todays.edits} tags={Object.fromEntries(Object.keys(changed).map((n) => [n, "Your change for this player"]))} />
            {todays.coach_note && <p className="text-sm"><span className="text-muted">Your note:</span> {todays.coach_note}</p>}
            {todays.status === "pending" && <p className="text-sm text-muted">Decide on the <Link href="/coach" className="underline underline-offset-4">Today</Link> screen.</p>}
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <Eyebrow>Last 14 days</Eyebrow>
        <Card className="p-5"><Heat days={days} /></Card>
      </section>

      <section id="plan-changes" className="space-y-3">
        <Eyebrow>This player’s own plan</Eyebrow>
        <Card className="space-y-4 p-5">
          <p className="max-w-2xl text-sm text-muted">A change here applies to every session that includes the exercise, for this player only, until you lift it or its end date passes. The rules then work from the changed plan. The player is told it is a personal change from you, not the reason.</p>
          {typeof overrideok === "string" && overrideok && <p className="rounded-md border border-ok/30 bg-ok-bg px-3 py-2 text-sm text-ok">{overrideok}</p>}
          {typeof overrideerr === "string" && overrideerr && <p className="rounded-md border border-bad/30 bg-bad-bg px-3 py-2 text-sm text-bad">{overrideerr}</p>}
          {activeOverrides.length === 0 ? (
            <p className="text-sm text-muted">No personal changes. {athlete.name.split(" ")[0]} follows {groupLabel(athlete.group) === "Everyone" ? "the program" : `the ${groupLabel(athlete.group)} program`}.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {activeOverrides.map((o) => (
                <li key={o.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <div className="font-medium">{describeOverride(o)}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {o.until ? `Until ${o.until}` : "Until you lift it"}{o.review_on ? ` · review ${o.review_on}` : ""} · set by {o.created_by || "staff"} {ago(o.created_at)}
                    </div>
                    {o.note && <div className="mt-1 text-xs text-muted">Private note: {o.note}</div>}
                  </div>
                  <form action={liftPlanOverride}>
                    <input type="hidden" name="code" value={athlete.code} />
                    <input type="hidden" name="id" value={o.id} />
                    <PendingButton className={btnGhost} pending="Lifting…">Lift</PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {pastOverrides.length > 0 && (
            <details className="text-sm">
              <summary className="disclosure cursor-pointer text-muted hover:text-ink">Earlier changes ({pastOverrides.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">{pastOverrides.map((o) => <li key={o.id}>{describeOverride(o)} · {o.lifted_at ? `lifted ${ago(o.lifted_at)}` : `ended ${o.until}`}</li>)}</ul>
            </details>
          )}
          {exerciseNames.length === 0 ? (
            <p className="text-sm text-muted">Import a program to choose from its exercises.</p>
          ) : (
            <form action={addPlanOverride} className="space-y-3 rounded-lg border border-line bg-paper p-4">
              <input type="hidden" name="code" value={athlete.code} />
              <div className="text-sm font-medium">Change an exercise for {athlete.name.split(" ")[0]}</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="ov-exercise" className="block text-xs font-medium text-muted">Exercise</label>
                  <select id="ov-exercise" name="exercise" required defaultValue="" className={`${input} mt-1`}><option value="" disabled>Choose</option>{exerciseNames.map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
                <div><label htmlFor="ov-swap" className="block text-xs font-medium text-muted">Swap to (optional)</label>
                  <input id="ov-swap" name="swap_to" maxLength={60} placeholder="e.g. Box squat" className={`${input} mt-1`} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="ov-sets" className="block text-xs font-medium text-muted">Max sets</label><input id="ov-sets" name="max_sets" type="number" min={1} max={20} className={`${input} mt-1`} /></div>
                <div><label htmlFor="ov-reps" className="block text-xs font-medium text-muted">Max reps</label><input id="ov-reps" name="max_reps" type="number" min={1} max={30} className={`${input} mt-1`} /></div>
                <div><label htmlFor="ov-load" className="block text-xs font-medium text-muted">Load, % of planned</label><input id="ov-load" name="load_pct" type="number" min={50} max={99} placeholder="e.g. 80" className={`${input} mt-1`} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="ov-until" className="block text-xs font-medium text-muted">Ends on (optional)</label><input id="ov-until" name="until" type="date" min={today} className={`${input} mt-1`} /></div>
                <div><label htmlFor="ov-review" className="block text-xs font-medium text-muted">Remind me to review on (optional)</label><input id="ov-review" name="review_on" type="date" min={today} className={`${input} mt-1`} /></div>
              </div>
              <div><label htmlFor="ov-note" className="block text-xs font-medium text-muted">Private note for staff (optional)</label>
                <input id="ov-note" name="note" maxLength={200} className={`${input} mt-1`} /></div>
              <p className="text-xs text-muted">Caps only reduce: a cap of 3 sets leaves a 2-set session alone. Leave a field empty to leave it as the program has it.</p>
              <PendingButton className={btnGhost} pending="Saving…">Save change</PendingButton>
            </form>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>Protected exercises</Eyebrow>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-muted">The agent never edits a protected exercise. Use this for a player who is managing something, then lift it when you clear them.</p>
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
          <summary className="disclosure cursor-pointer px-5 py-3.5 text-sm font-medium text-muted hover:text-ink">Remove this player</summary>
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
