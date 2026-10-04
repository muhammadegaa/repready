import Link from "next/link";
import { approveRoutine, confirmPlayer, takeBack } from "@/actions/coach";
import { draftNextWeek } from "@/actions/program";
import { PendingButton } from "@/components/Pending";
import { CopyButton } from "@/components/CopyButton";
import { MinutesFlow, parseMinutesPreview } from "@/components/MinutesFlow";
import { GetStarted } from "@/components/GetStarted";
import { Live } from "@/components/Live";
import { CountUp, LeaveOnSubmit } from "@/components/motion";
import { ProposalCard } from "@/components/ProposalCard";
import { Spark } from "@/components/Spark";
import { btn, btnGhost, Card, Chip, Eyebrow, Notice, Stat } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { ago, dateLabel } from "@/lib/copy";
import { isRoutine } from "@/lib/autonomy";
import { revealStyle } from "@/lib/motion";
import { allRules } from "@/lib/rules";
import { todayStr } from "@/lib/run-agent";
import { countSessions, getNotice, getPulse } from "@/lib/store";
import { coachToday, squadMap, STATUS } from "@/lib/views";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Today(props: PageProps<"/coach">) {
  const { club, name } = await requirePage("coach");
  const today = todayStr();
  const { notice } = await props.searchParams;
  const [data, rules, pulse, sessionCount, minutesRaw, minutesError] = await Promise.all([coachToday(club, today), allRules(club), getPulse(club, "coach"), countSessions(club), getNotice(club, "minutes_preview"), getNotice(club, "minutes")]);
  const { session, versions, reviews, roster, pending, events, counts, waiting } = data;
  // Quiet watching: who is drifting down or has gone silent. Described, never acted on.
  const watch = roster.length ? (await squadMap(club, today)).rows.filter((r) => r.trend === "worse" || r.trend === "quiet") : [];
  const notIn = roster.filter((r) => r.status === "waiting");
  const hasSample = roster.some((r) => r.athlete.sample);
  const nudge = waiting > 0 ? "waiting" : reviews.length > 0 ? "reviews" : data.matchToLog ? "minutes" : data.nextWeekOffer ? "nextweek" : null;
  const routine = pending.filter((e) => e.proposal && isRoutine(e.proposal));
  const handled = roster.filter((e) => e.proposal?.status === "approved" && e.proposal.decided_by === "delegated");

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-muted">{dateLabel(today)}</p>
        </div>
        {session ? (
          <Link href="/coach/program" className="text-sm text-muted hover:text-ink">
            <span className="font-medium text-ink">{session.label}</span> · {session.exercises.length} exercises{session.week_type === "deload" ? " · deload week" : ""}{versions > 1 ? ` · ${versions} versions today` : ""}
          </Link>
        ) : (
          <Link href="/coach/program" className="text-sm font-medium underline underline-offset-4">No session today. Open the program</Link>
        )}
      </header>

      <GetStarted
        name={name}
        state={{ players: counts.athletes, waiting, sessions: sessionCount, agreed: roster.filter((r) => r.athlete.consented_at).length, checkedIn: counts.checkedIn }}
        hasSample={hasSample}
      />
      {hasSample && (
        <Notice>
          You are looking at a <b>sample squad</b>: fictional players, not real data. Remove it from <Link href="/coach/squad" className="font-medium underline underline-offset-4">Squad</Link> when you add your own.
        </Notice>
      )}

      {notice && <Notice>{notice}</Notice>}
      {/* One thing at a time: the most useful next step, not a stack of banners. */}
      {nudge === "waiting" && (
        <Card className="space-y-3 border-brand/30 bg-brand-soft/50 p-5">
          <div>
            <h3 className="font-semibold">{waiting} player{waiting === 1 ? " has" : "s have"} asked to join</h3>
            <p className="mt-0.5 text-sm text-muted">They used your squad link. Confirm the ones you know. Anyone else you can remove in Squad.</p>
          </div>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface text-sm">
            {data.joiners.map((j) => (
              <li key={j.code} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                <span><b>{j.name}</b>{j.position ? <span className="text-muted"> · {j.position}</span> : null}{j.shirt ? <span className="text-muted"> · #{j.shirt}</span> : null}</span>
                <form action={confirmPlayer}><input type="hidden" name="code" value={j.code} /><PendingButton className={btn} pending="Confirming…">Confirm</PendingButton></form>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {nudge === "reviews" && (
        <Notice>
          Plan changes to review: {reviews.map((o, i) => (
            <span key={o.id}>{i ? ", " : ""}<Link href={`/coach/athletes/${o.athlete_code}#plan-changes`} className="font-medium underline underline-offset-4">{o.athlete_name} ({o.exercise})</Link></span>
          ))}.
        </Notice>
      )}
      {nudge === "minutes" && data.matchToLog && (
        <Card className="space-y-3 border-brand/30 bg-brand-soft/50 p-5">
          <h3 className="font-semibold">There was a match on {dateLabel(data.matchToLog)}. Who played?</h3>
          <MinutesFlow preview={parseMinutesPreview(minutesRaw)} error={minutesError} back="/coach" date={data.matchToLog} today={today} dateLocked id="today_minutes" />
        </Card>
      )}
      {nudge === "nextweek" && (
        <Notice tone="ok">
          <form action={draftNextWeek} className="flex flex-wrap items-center justify-between gap-3">
            <input type="hidden" name="from" value="today" />
            <span>Next week has no sessions yet. Start it from this week?</span>
            <PendingButton className="font-medium underline underline-offset-4" pending="Drafting…">Draft next week</PendingButton>
          </form>
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat label="Players" value={<CountUp value={counts.athletes} />} />
        <Stat label="Checked in" value={<><CountUp value={counts.checkedIn} />/{counts.athletes}</>} hint={counts.athletes === 0 ? "Add players in Squad" : undefined} />
        <Stat label="Need you" value={<CountUp value={counts.needsDecision} />} tone={counts.needsDecision ? "warn" : undefined} />
        <Stat label="Adjusted" value={<CountUp value={counts.adjusted} />} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className="space-y-3">
            <Eyebrow>Needs you</Eyebrow>
            {pending.length === 0 ? (
              <Card className="px-5 py-8 text-center">
                <p className="font-medium">{counts.checkedIn === 0 ? "Nobody has checked in yet." : counts.athletes > 0 && counts.checkedIn === counts.athletes ? "All clear. Everyone has checked in and nothing needs you." : "Nothing is waiting on you."}</p>
                <p className="mt-1 text-sm text-muted">{counts.checkedIn === 0 ? "A suggestion appears here the moment a player checks in and the agent has read their numbers." : "If a check-in needs a decision, it appears here straight away."}</p>
              </Card>
            ) : (
              <>
                {routine.length >= 2 && (
                  <LeaveOnSubmit><Card className="space-y-3 border-brand/30 bg-brand-soft/50 p-5">
                    <div>
                      <h3 className="font-semibold">{routine.length} routine suggestions, all the same kind</h3>
                      <p className="mt-0.5 text-sm text-muted">Small volume trims, nothing flagged, nothing the limits had to change. Look them over, then approve them together. Anything else stays below for you.</p>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {routine.map((e) => <li key={e.proposal!.id}><b>{e.athlete.name}</b> <span className="text-muted">· {e.proposal!.reason}</span></li>)}
                    </ul>
                    <form action={approveRoutine}><PendingButton className={btn} pending="Approving…">Approve these {routine.length}</PendingButton></form>
                  </Card></LeaveOnSubmit>
                )}
                {pending.map((e, i) => e.session && <div key={e.proposal!.id} className="reveal" style={revealStyle(i)}><LeaveOnSubmit><ProposalCard entry={e} session={e.session} rules={rules} /></LeaveOnSubmit></div>)}
              </>
            )}
          </section>

          {handled.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Handled for you ({handled.length})</Eyebrow>
              <Card className="divide-y divide-line">
                {handled.map((e) => (
                  <LeaveOnSubmit key={e.proposal!.id}><form action={takeBack} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <input type="hidden" name="id" value={e.proposal!.id} />
                    <div className="min-w-0 text-sm">
                      <b>{e.athlete.name}</b> <span className="text-muted">· {e.proposal!.reason}</span>
                      <div className="text-xs text-muted">Applied under your standing instruction for {e.proposal!.rules_applied.join(", ")}.</div>
                    </div>
                    <PendingButton className="text-sm text-muted underline underline-offset-4" pending="Taking back…">Take it back</PendingButton>
                  </form></LeaveOnSubmit>
                ))}
              </Card>
            </section>
          )}

          {watch.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Worth a look</Eyebrow>
              <Card className="divide-y divide-line">
                {watch.map((r) => (
                  <Link key={r.athlete.code} href={`/coach/athletes/${r.athlete.code}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition hover:bg-paper">
                    <span><b>{r.athlete.name}</b> <span className="text-muted">· {r.trend === "worse" ? "the last three days are clearly worse than the three before" : "no answers for three days"}</span></span>
                    <Chip tone={r.trend === "worse" ? "warn" : "neutral"}>{r.trend === "worse" ? "Trending down" : "Quiet"}</Chip>
                  </Link>
                ))}
                <div className="px-5 py-2.5 text-xs text-muted">Against each player’s own usual. See everyone on the <Link href="/coach/squad?view=map" className="underline underline-offset-4">squad map</Link>.</div>
              </Card>
            </section>
          )}

          <section className="space-y-3">
            <Eyebrow>Squad today</Eyebrow>
            {roster.length === 0 ? (
              <Card className="px-5 py-6 text-sm text-muted">
                No players yet. Follow the steps above, or open <Link href="/coach/squad" className="underline underline-offset-4">Squad</Link>.
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {roster.map((e, i) => {
                  const st = STATUS[e.status];
                  const c = e.checkin;
                  return (
                    <Link key={e.athlete.code} href={`/coach/athletes/${e.athlete.code}`} style={revealStyle(i)} className="reveal flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition hover:bg-paper">
                      <div className="min-w-32 flex-1">
                        <div className="font-medium">{e.athlete.shirt ? <span className="mr-2 font-mono text-muted">{e.athlete.shirt}</span> : null}{e.athlete.name}{e.athlete.position ? <span className="ml-2 text-xs font-normal text-muted">{e.athlete.position}</span> : null}{e.athlete.group ? <span className="ml-2 align-middle"><Chip tone="neutral">{e.athlete.group}</Chip></span> : null}{e.athlete.sample ? <span className="ml-2 align-middle"><Chip tone="warn">Sample</Chip></span> : null}</div>
                        <div className="text-xs text-muted">
                          {c ? `${e.readiness?.sleep_h ?? c.sleep_h} h sleep · soreness ${c.soreness} · stress ${c.stress}` : e.athlete.consented_at ? "No check-in yet today" : "Link sent, not opened"}
                        </div>
                      </div>
                      <Spark values={e.sleep7} />
                      <div className="w-32 text-right"><Chip tone={st.tone}>{st.label}</Chip></div>
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          {notIn.length > 0 && (
            <section className="space-y-3">
              <Eyebrow>Not checked in ({notIn.length})</Eyebrow>
              <Card className="divide-y divide-line">
                {notIn.map((e) => (
                  <div key={e.athlete.code} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm">{e.athlete.name}</span>
                    <CopyButton
                      path={`/a/${e.athlete.code}`}
                      label="Copy reminder"
                      message={`Morning ${e.athlete.name.split(" ")[0]}, please do your RepReady check-in before training: {url}`}
                      className={`${btnGhost} px-3 py-1 text-xs`}
                    />
                  </div>
                ))}
              </Card>
              <p className="text-xs text-muted">Copies a message with that player’s own link. Paste it into your team chat or a direct message.</p>
            </section>
          )}

          <section className="space-y-3">
            <Eyebrow>Squad</Eyebrow>
            <Card className="space-y-2 p-4">
              <p className="text-sm">{counts.athletes} player{counts.athletes === 1 ? "" : "s"}, {roster.filter((r) => r.athlete.device_token).length} on their own phone.</p>
              <Link href="/coach/squad" className={btnGhost}>Manage squad and links</Link>
            </Card>
          </section>

          <section className="space-y-3">
            <Eyebrow>Activity</Eyebrow>
            <Card className="divide-y divide-line">
              {events.length === 0 && <p className="px-4 py-4 text-sm text-muted">Nothing yet.</p>}
              {events.map((ev, i) => (
                <div key={ev.id} style={revealStyle(i)} className="reveal px-4 py-2.5">
                  <p className="text-sm leading-snug">{ev.text}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-muted">{ago(ev.at)}</p>
                </div>
              ))}
            </Card>
          </section>
        </aside>
      </div>
    </div>
  );
}
