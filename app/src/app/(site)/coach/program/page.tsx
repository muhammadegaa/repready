import Link from "next/link";
import { importProgram, saveFixtureList } from "@/actions/coach";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btn, Card, Chip, Eyebrow, input } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { dateLabel } from "@/lib/copy";
import { matchDayTag } from "@/lib/fixtures";
import { groupLabel } from "@/lib/groups";
import { todayStr } from "@/lib/run-agent";
import { getFixtures, getNotice, getPulse, listSessions } from "@/lib/store";

export const metadata = { title: "Program" };
export const dynamic = "force-dynamic";

export default async function Program() {
  const { club } = await requirePage("coach");
  const today = todayStr();
  const [sessions, importError, fixtureError, fixtures, pulse] = await Promise.all([listSessions(club, today, 60), getNotice(club, "import"), getNotice(club, "fixtures"), getFixtures(club), getPulse(club, "coach")]);
  const example = `date,label,week_type,exercise,sets,reps,load,target_rpe
${today},Lower strength,normal,Back squat,4,5,85% 1RM,8
${today},Lower strength,normal,Romanian deadlift,3,8,70% 1RM,7
${today},Lower strength,normal,Split squat,3,8,RPE 7,7`;

  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Program</h1>
        <p className="mt-1 max-w-2xl text-muted">Rows with no group are the session for everyone. A row with a group name is that group’s own version of the session, and its players get it instead. Pasting a new program replaces all sessions.</p>
      </header>

      <section className="space-y-3">
        <Eyebrow>Upcoming sessions</Eyebrow>
        {sessions.length === 0 ? (
          <Card className="px-5 py-6 text-sm text-muted">No sessions from today onward. Paste your program below.</Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sessions.map((s) => (
              <Card key={s.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{s.label}</div>
                    <div className="text-xs text-muted">{dateLabel(s.on_date)}</div>
                  </div>
                  <div className="flex gap-1.5">
                    {matchDayTag(s.on_date, fixtures) && <Chip tone="neutral">{matchDayTag(s.on_date, fixtures)}</Chip>}
                    {s.on_date === today && <Chip tone="marker">Today</Chip>}
                    {s.week_type === "deload" && <Chip tone="neutral">Deload</Chip>}
                    <Chip tone={s.group ? "marker" : "neutral"}>{s.group ? `Group: ${groupLabel(s.group)}` : "Everyone"}</Chip>
                  </div>
                </div>
                <SessionTable planned={s.exercises} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <Eyebrow>Fixtures</Eyebrow>
        <Card className="space-y-3 p-5">
          {fixtureError && <pre className="whitespace-pre-wrap rounded-md border border-bad/30 bg-bad-bg p-3 text-sm text-bad">{fixtureError}</pre>}
          <p className="text-sm text-muted">Match dates, one per line or comma-separated (YYYY-MM-DD). Sessions within three days of a match are tagged MD-2, MD, MD+1 and so on, and the agent is told.</p>
          <form action={saveFixtureList} className="space-y-3">
            <label htmlFor="fixtures" className="block text-sm font-medium">Match dates</label>
            <textarea id="fixtures" name="fixtures" rows={3} defaultValue={fixtures.join("\n")} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btn} pending="Saving…">Save fixtures</PendingButton>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>Import</Eyebrow>
        <Card className="space-y-3 p-5">
          {importError && <pre className="whitespace-pre-wrap rounded-md border border-line bg-paper p-3 text-sm text-ink">{importError}</pre>}
          <p className="text-sm text-muted">One row per exercise. Columns: date (YYYY-MM-DD), label, week_type (normal or deload), exercise, sets, reps, load, target_rpe (optional). Add a ninth column, <span className="font-mono">group</span>, to give a group its own version, for example <span className="font-mono">Reserves</span>. Assign players to groups in <Link href="/coach/squad" className="underline underline-offset-4">Squad</Link>.</p>
          <form action={importProgram} className="space-y-3">
            <label htmlFor="csv" className="block text-sm font-medium">Program CSV</label>
            <textarea id="csv" name="csv" rows={9} defaultValue={example} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btn} pending="Importing…">{sessions.length ? "Replace program" : "Import program"}</PendingButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
