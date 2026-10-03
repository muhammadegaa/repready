import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { GetStarted } from "@/components/GetStarted";
import { Live } from "@/components/Live";
import { ProposalCard } from "@/components/ProposalCard";
import { Spark } from "@/components/Spark";
import { btnGhost, Card, Chip, Eyebrow, Notice, Stat } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { ago, dateLabel } from "@/lib/copy";
import { allRules } from "@/lib/rules";
import { todayStr } from "@/lib/run-agent";
import { countSessions, getPulse } from "@/lib/store";
import { coachToday, STATUS } from "@/lib/views";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Today(props: PageProps<"/coach">) {
  const { club, name } = await requirePage("coach");
  const today = todayStr();
  const { notice } = await props.searchParams;
  const [data, rules, pulse, sessionCount] = await Promise.all([coachToday(club, today), allRules(club), getPulse(club, "coach"), countSessions(club)]);
  const { session, versions, reviews, roster, pending, events, counts, waiting } = data;
  const notIn = roster.filter((r) => r.status === "waiting");
  const hasSample = roster.some((r) => r.athlete.sample);

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
      {reviews.length > 0 && (
        <Notice>
          Plan changes to review: {reviews.map((o, i) => (
            <span key={o.id}>{i ? ", " : ""}<Link href={`/coach/athletes/${o.athlete_code}#plan-changes`} className="font-medium underline underline-offset-4">{o.athlete_name} ({o.exercise})</Link></span>
          ))}.
        </Notice>
      )}
      {waiting > 0 && (
        <Notice>{waiting} player{waiting === 1 ? " has" : "s have"} asked to join the squad. <Link href="/coach/squad" className="font-medium underline underline-offset-4">Confirm in Squad</Link>.</Notice>
      )}

      {data.matchToLog && (
        <Notice tone="ok">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>There was a match on {dateLabel(data.matchToLog)}. Who played?</span>
            <Link href={`/coach/program?matchdate=${data.matchToLog}#minutes`} className="font-medium underline underline-offset-4">Add minutes</Link>
          </span>
        </Notice>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat label="Players" value={counts.athletes} />
        <Stat label="Checked in" value={`${counts.checkedIn}/${counts.athletes}`} hint={counts.athletes === 0 ? "Add players in Squad" : undefined} />
        <Stat label="Need you" value={counts.needsDecision} tone={counts.needsDecision ? "warn" : undefined} />
        <Stat label="Adjusted" value={counts.adjusted} />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section className="space-y-3">
            <Eyebrow>Needs you</Eyebrow>
            {pending.length === 0 ? (
              <Card className="px-5 py-8 text-center">
                <p className="font-medium">{counts.checkedIn === 0 ? "Nobody has checked in yet." : "Nothing is waiting on you."}</p>
                <p className="mt-1 text-sm text-muted">A proposal appears here the moment a player checks in and the agent has read their numbers.</p>
              </Card>
            ) : (
              pending.map((e) => e.session && <ProposalCard key={e.proposal!.id} entry={e} session={e.session} rules={rules} />)
            )}
          </section>

          <section className="space-y-3">
            <Eyebrow>Squad today</Eyebrow>
            {roster.length === 0 ? (
              <Card className="px-5 py-6 text-sm text-muted">
                No players yet. Follow the steps above, or open <Link href="/coach/squad" className="underline underline-offset-4">Squad</Link>.
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {roster.map((e) => {
                  const st = STATUS[e.status];
                  const c = e.checkin;
                  return (
                    <Link key={e.athlete.code} href={`/coach/athletes/${e.athlete.code}`} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition hover:bg-paper">
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
              {events.map((ev) => (
                <div key={ev.id} className="px-4 py-2.5">
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
