import Link from "next/link";
import { confirmMinutes, discardMinutes, readMinutesAction, removeCalendarAction, saveCalendarAction, saveFixtureList } from "@/actions/coach";
import { draftNextWeek, readProgramAction } from "@/actions/program";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btn, btnGhost, Card, Chip, Eyebrow, input } from "@/components/ui";
import { nextMonday } from "@/lib/read/carry";
import { addDays, defaultWeekStart } from "@/lib/read/program";
import { requirePage } from "@/lib/auth";
import { ago, dateLabel } from "@/lib/copy";
import { matchDayTag } from "@/lib/fixtures";
import { groupLabel } from "@/lib/groups";
import { todayStr } from "@/lib/run-agent";
import { getCalendarLink, getFixtures, getManualFixtures, getNotice, getPulse, listSessions } from "@/lib/store";

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
  const [sessions, fixtureError, minutesError, minutesPreview, fixtures, manualFixtures, calendar, pulse] = await Promise.all([listSessions(club, today, 60), getNotice(club, "fixtures"), getNotice(club, "minutes"), getNotice(club, "minutes_preview"), getFixtures(club), getManualFixtures(club), getCalendarLink(club), getPulse(club, "coach")]);
  const asked = typeof q.matchdate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q.matchdate) ? q.matchdate : null;
  const target = nextMonday(today);
  const canCopy = (await listSessions(club, addDays(target, -7), 100)).some((x) => !x.sample && x.on_date < target);
  const lastMatch = asked ?? [...fixtures].filter((d) => d <= today).pop() ?? addDays(today, -1);
  const preview = (() => { try { return JSON.parse(minutesPreview ?? "") as { date: string; rows: { code: string; name: string; minutes: number }[]; unmatched: string[] }; } catch { return null; } })();

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
          {canCopy && (
            <form action={draftNextWeek} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-paper p-3">
              <span className="text-sm">Planning next week? Start from this week and change what is different. Match days from your fixtures are pointed out.</span>
              <PendingButton className={btnGhost} pending="Drafting…">Start from this week</PendingButton>
            </form>
          )}
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
          {calendar ? (
            <div className="space-y-2 rounded-md border border-line bg-paper p-3 text-sm">
              <p>
                <b>Synced with your club calendar.</b> {calendar.dates.length} match date{calendar.dates.length === 1 ? "" : "s"} found{calendar.synced_at ? `, last read ${ago(calendar.synced_at)}` : ""}. It is read again every morning.
              </p>
              {calendar.examples.length > 0 && <p className="text-muted">For example: {calendar.examples.slice(0, 3).join(" · ")}</p>}
              {calendar.error && <p className="text-warn">The last read failed: {calendar.error} The dates above are from the last good read.</p>}
              <form action={removeCalendarAction}><PendingButton className="text-sm text-muted underline underline-offset-4" pending="Removing…">Stop syncing</PendingButton></form>
            </div>
          ) : (
            <form action={saveCalendarAction} className="space-y-2">
              <label htmlFor="calendar" className="block text-sm font-medium">Link your club calendar</label>
              <p className="text-sm text-muted">Paste the calendar link once (in Google Calendar: Settings → your calendar → “Secret address in iCal format”) and match dates stay up to date by themselves. Only events with “v”, “vs” or “match” in the title are taken.</p>
              <input id="calendar" name="calendar" inputMode="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" className={input} />
              <PendingButton className={btn} pending="Reading…">Link calendar</PendingButton>
            </form>
          )}
          <p className="text-sm text-muted">Or paste match dates as they are: “Sat 11 Oct v Reading (H)”, “18/10/2026” or “2026-10-25”, one per line. Sessions within three days of a match are tagged MD-2, MD, MD+1 and so on, and the agent is told.</p>
          <form action={saveFixtureList} className="space-y-3">
            <label htmlFor="fixtures" className="block text-sm font-medium">Match dates</label>
            <textarea id="fixtures" name="fixtures" rows={3} defaultValue={manualFixtures.join("\n")} className={`${input} font-mono text-[13px]`} />
            <PendingButton className={btn} pending="Saving…">Save fixtures</PendingButton>
          </form>
        </Card>
      </section>
      <section id="minutes" className="space-y-3">
        <Eyebrow>Match minutes</Eyebrow>
        <Card className="space-y-3 p-5">
          {minutesError && <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{minutesError}</div>}
          {preview ? (
            <div className="space-y-3">
              <p className="text-sm">I matched {preview.rows.length} player{preview.rows.length === 1 ? "" : "s"} for {dateLabel(preview.date)}. Check them, then save.</p>
              <ul className="max-h-64 divide-y divide-line overflow-auto rounded-md border border-line text-sm">
                {preview.rows.map((r) => <li key={r.code} className="flex justify-between gap-3 px-3 py-1.5"><span className="font-medium">{r.name}</span><span className="tabular-nums text-muted">{r.minutes} min</span></li>)}
              </ul>
              {preview.unmatched.length > 0 && <p className="text-sm text-muted">Not matched to a single player, so left out: {preview.unmatched.map((l) => `“${l}”`).join(", ")}</p>}
              <div className="flex gap-3">
                <form action={confirmMinutes}><PendingButton className={btn} pending="Saving…">Save minutes</PendingButton></form>
                <form action={discardMinutes}><PendingButton className="text-sm text-muted underline underline-offset-4" pending="…">Start again</PendingButton></form>
              </div>
            </div>
          ) : (
            <form action={readMinutesAction} className="space-y-3">
              <p className="text-sm text-muted">After a match, jot who played and for how long, one per line: “Ola Adeyemi 90”, “Ortiz 65”, “Sam DNP”. It shows on each player&apos;s page next to how they check in. It does not change anyone&apos;s session.</p>
              <div>
                <label htmlFor="minutes_date" className="block text-sm font-medium">Match date</label>
                <input id="minutes_date" name="date" type="date" max={today} defaultValue={lastMatch} className={`${input} mt-1 max-w-48`} />
              </div>
              <label htmlFor="minutes_text" className="sr-only">Minutes played</label>
              <textarea id="minutes_text" name="minutes" rows={5} className={input} placeholder={"Ola Adeyemi 90\nOrtiz 65\nSam DNP"} />
              <PendingButton className={btn} pending="Reading…">Read minutes</PendingButton>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
}
