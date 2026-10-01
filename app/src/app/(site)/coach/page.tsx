import Link from "next/link";
import { redirect } from "next/navigation";
import { addAthlete } from "@/actions/coach";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { ProposalCard } from "@/components/ProposalCard";
import { Spark } from "@/components/Spark";
import { btn, Card, Chip, Eyebrow, input, Notice, Stat } from "@/components/ui";
import { getRole } from "@/lib/auth";
import { ago, dateLabel } from "@/lib/copy";
import { allRules } from "@/lib/rules";
import { todayStr } from "@/lib/run-agent";
import { countLeads, getPulse, listLeads } from "@/lib/store";
import { coachToday, STATUS } from "@/lib/views";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

export default async function Today(props: PageProps<"/coach">) {
  if ((await getRole()) !== "coach") redirect("/signin");
  const today = todayStr();
  const { notice } = await props.searchParams;
  const [data, rules, pulse, leads, leadCount] = await Promise.all([coachToday(today), allRules(), getPulse("coach"), listLeads(6), countLeads()]);
  const { session, roster, pending, events, counts } = data;

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
            <span className="font-medium text-ink">{session.label}</span> · {session.exercises.length} exercises{session.week_type === "deload" ? " · deload week" : ""}
          </Link>
        ) : (
          <Link href="/coach/program" className="text-sm font-medium underline underline-offset-4">No session today. Open the program</Link>
        )}
      </header>

      {notice && <Notice>{notice}</Notice>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat label="Athletes" value={counts.athletes} />
        <Stat label="Checked in" value={`${counts.checkedIn}/${counts.athletes}`} hint={counts.athletes === 0 ? "Add athletes below" : undefined} />
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
                <p className="mt-1 text-sm text-muted">A proposal appears here the moment an athlete checks in and the agent has read their numbers.</p>
              </Card>
            ) : (
              pending.map((e) => session && <ProposalCard key={e.proposal!.id} entry={e} session={session} rules={rules} />)
            )}
          </section>

          <section className="space-y-3">
            <Eyebrow>Athletes</Eyebrow>
            {roster.length === 0 ? (
              <Card className="px-5 py-6">
                <p className="font-medium">Start here</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                  <li>Add your athletes with the form on the right.</li>
                  <li>Import your program in <Link href="/coach/program" className="underline underline-offset-4">Program</Link>.</li>
                  <li>Send each athlete their link. They consent once, then check in daily.</li>
                </ol>
              </Card>
            ) : (
              <Card className="divide-y divide-line">
                {roster.map((e) => {
                  const st = STATUS[e.status];
                  const c = e.checkin;
                  return (
                    <Link key={e.athlete.code} href={`/coach/athletes/${e.athlete.code}`} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 transition hover:bg-paper">
                      <div className="min-w-32 flex-1">
                        <div className="font-medium">{e.athlete.name}</div>
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
          <section className="space-y-3">
            <Eyebrow>Add an athlete</Eyebrow>
            <form action={addAthlete} className="flex gap-2">
              <label htmlFor="athlete-name" className="sr-only">Athlete name</label>
              <input id="athlete-name" name="name" placeholder="First name" required maxLength={80} className={input} />
              <PendingButton className={btn} pending="Adding…">Add</PendingButton>
            </form>
            <p className="text-xs text-muted">Each athlete gets a private link. Open their row to copy it.</p>
          </section>

          {leadCount > 0 && (
            <section className="space-y-3">
              <Eyebrow>Waitlist · {leadCount}</Eyebrow>
              <Card className="divide-y divide-line">
                {leads.map((l) => (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <a href={`mailto:${l.email}`} className="min-w-0 truncate underline-offset-4 hover:underline">{l.email}</a>
                    <span className="shrink-0 font-mono text-[11px] text-muted">{ago(l.created_at)}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}

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
