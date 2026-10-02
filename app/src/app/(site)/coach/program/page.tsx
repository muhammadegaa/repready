import Link from "next/link";
import { importProgram } from "@/actions/coach";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { SessionTable } from "@/components/SessionTable";
import { btn, Card, Chip, Eyebrow, input } from "@/components/ui";
import { requirePage } from "@/lib/auth";
import { dateLabel } from "@/lib/copy";
import { todayStr } from "@/lib/run-agent";
import { getNotice, getPulse, listSessions } from "@/lib/store";

export const metadata = { title: "Program" };
export const dynamic = "force-dynamic";

export default async function Program() {
  const { club } = await requirePage("coach");
  const today = todayStr();
  const [sessions, importError, pulse] = await Promise.all([listSessions(club, today, 60), getNotice(club, "import"), getPulse(club, "coach")]);
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
        <p className="mt-1 text-muted">One program applies to every player. Pasting a new one replaces all sessions.</p>
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
                    {s.on_date === today && <Chip tone="marker">Today</Chip>}
                    {s.week_type === "deload" && <Chip tone="neutral">Deload</Chip>}
                  </div>
                </div>
                <SessionTable planned={s.exercises} />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <Eyebrow>Import</Eyebrow>
        <Card className="space-y-3 p-5">
          {importError && <pre className="whitespace-pre-wrap rounded-md border border-bad/30 bg-bad-bg p-3 text-sm text-bad">{importError}</pre>}
          <p className="text-sm text-muted">One row per exercise. Columns: date (YYYY-MM-DD), label, week_type (normal or deload), exercise, sets, reps, load, target_rpe (optional).</p>
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
