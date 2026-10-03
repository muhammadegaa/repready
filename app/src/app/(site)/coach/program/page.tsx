import Link from "next/link";
import { saveFixtureList } from "@/actions/coach";
import { readProgramAction } from "@/actions/program";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btn, Card, Chip, Eyebrow, input } from "@/components/ui";
import { defaultWeekStart } from "@/lib/read/program";
import { requirePage } from "@/lib/auth";
import { dateLabel } from "@/lib/copy";
import { matchDayTag } from "@/lib/fixtures";
import { groupLabel } from "@/lib/groups";
import { todayStr } from "@/lib/run-agent";
import { getFixtures, getNotice, getPulse, listSessions } from "@/lib/store";

export const metadata = { title: "Program" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Program({ searchParams }: PageProps<"/coach/program">) {
  const q = await searchParams;
  const one = (k: string) => (typeof q[k] === "string" ? (q[k] as string).slice(0, 400) : null);
  const readerr = one("readerr");
  const applied = one("applied");
  const { club } = await requirePage("coach");
  const today = todayStr();
  const [sessions, fixtureError, fixtures, pulse] = await Promise.all([listSessions(club, today, 60), getNotice(club, "fixtures"), getFixtures(club), getPulse(club, "coach")]);
  return (
    <div className="space-y-8">
      <Live scope="coach" initial={pulse} />
      <header>
        <Link href="/coach" className="text-sm text-muted hover:text-ink">← Today</Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Program</h1>
        <p className="mt-1 max-w-2xl text-muted">Give me your program the way you already have it. I read it, you check it, and only then does it reach your players.</p>
      </header>

      {applied && <div className="rounded-lg border border-line bg-paper px-4 py-3 text-sm">{applied}</div>}

      <section className="space-y-3">
        <Eyebrow>Tell me your program</Eyebrow>
        <Card className="space-y-3 p-5">
          {readerr && <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{readerr}</div>}
          <p className="text-sm text-muted">Paste a week from a message, a document or a spreadsheet, or choose the file. Name a group (Starters, Reserves) and it gets its own version. Nothing changes for players until you press Use this program.</p>
          <form action={readProgramAction} className="space-y-3">
            <div>
              <label htmlFor="week_start" className="block text-sm font-medium">Week starting (Monday)</label>
              <input id="week_start" name="week_start" type="date" defaultValue={defaultWeekStart(today)} className={`${input} mt-1 max-w-48`} />
            </div>
            <div>
              <label htmlFor="program_text" className="block text-sm font-medium">Your program</label>
              <textarea id="program_text" name="text" rows={8} placeholder={"Mon - Lower: back squat 4x5 @85%, RDL 3x8\nWed - Upper: bench 4x6, row 4x8\nFri - Reserves: split squat 3x8, hip thrust 3x10"} className={input} />
            </div>
            <div>
              <label htmlFor="program_file" className="block text-sm font-medium">Or a file (.xlsx, .csv, .txt)</label>
              <input id="program_file" name="file" type="file" accept=".xlsx,.csv,.txt" className="mt-1 block text-sm" />
            </div>
            <p className="text-xs text-muted">An outside assistant reads only the program you give it here. Leave out players’ names and any health information.</p>
            <PendingButton className={btn} pending="Reading…">Read my program</PendingButton>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
        <Eyebrow>Upcoming sessions</Eyebrow>
        {sessions.length === 0 ? (
          <Card className="px-5 py-6 text-sm text-muted">No sessions from today onward. Tell me your program above.</Card>
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
          {fixtureError && <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{fixtureError}</div>}
          <p className="text-sm text-muted">Paste your fixture list as it is: “Sat 11 Oct v Reading (H)”, “18/10/2026” or “2026-10-25”, one per line. Sessions within three days of a match are tagged MD-2, MD, MD+1 and so on, and the agent is told.</p>
          <form action={saveFixtureList} className="space-y-3">
            <label htmlFor="fixtures" className="block text-sm font-medium">Match dates</label>
            <textarea id="fixtures" name="fixtures" rows={3} defaultValue={fixtures.join("\n")} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btn} pending="Saving…">Save fixtures</PendingButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
