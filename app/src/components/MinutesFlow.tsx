import { confirmMinutes, discardMinutes, readMinutesAction } from "@/actions/coach";
import { dateLabel } from "@/lib/copy";
import { PendingButton } from "./Pending";
import { btn, input } from "./ui";

export type MinutesPreview = { date: string; rows: { code: string; name: string; minutes: number }[]; unmatched: string[] };

export function parseMinutesPreview(raw: string | null): MinutesPreview | null {
  try { return raw ? (JSON.parse(raw) as MinutesPreview) : null; } catch { return null; }
}

// Jot who played, check the matches, save. The same flow on Today (where it returns to Today) and on Program.
export function MinutesFlow({ preview, error, back, date, today, dateLocked = false, id = "minutes" }: {
  preview: MinutesPreview | null; error: string | null; back: "/coach" | "/coach/program"; date: string; today: string; dateLocked?: boolean; id?: string;
}) {
  return (
    <div className="space-y-3">
      {error && <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm text-warn">{error}</div>}
      {preview ? (
        <div className="space-y-3">
          <p className="text-sm">I matched {preview.rows.length} player{preview.rows.length === 1 ? "" : "s"} for {dateLabel(preview.date)}. Check them, then save.</p>
          <ul className="max-h-64 divide-y divide-line overflow-auto rounded-md border border-line bg-surface text-sm">
            {preview.rows.map((r) => <li key={r.code} className="flex justify-between gap-3 px-3 py-1.5"><span className="font-medium">{r.name}</span><span className="tabular-nums text-muted">{r.minutes} min</span></li>)}
          </ul>
          {preview.unmatched.length > 0 && <p className="text-sm text-muted">Not matched to a single player, so left out: {preview.unmatched.map((l) => `“${l}”`).join(", ")}</p>}
          <div className="flex gap-3">
            <form action={confirmMinutes}><input type="hidden" name="back" value={back} /><PendingButton className={btn} pending="Saving…">Save minutes</PendingButton></form>
            <form action={discardMinutes}><input type="hidden" name="back" value={back} /><PendingButton className="text-sm text-muted underline underline-offset-4" pending="…">Start again</PendingButton></form>
          </div>
        </div>
      ) : (
        <form action={readMinutesAction} className="space-y-3">
          <input type="hidden" name="back" value={back} />
          <p className="text-sm text-muted">Jot who played and for how long, one per line: “Ola Adeyemi 90”, “Ortiz 65”, “Sam DNP”. It shows on each player&apos;s page next to how they check in. It does not change anyone&apos;s session.</p>
          {dateLocked ? (
            <input type="hidden" name="date" value={date} />
          ) : (
            <div>
              <label htmlFor={`${id}_date`} className="block text-sm font-medium">Match date</label>
              <input id={`${id}_date`} name="date" type="date" max={today} defaultValue={date} className={`${input} mt-1 max-w-48`} />
            </div>
          )}
          <label htmlFor={`${id}_text`} className="sr-only">Minutes played</label>
          <textarea id={`${id}_text`} name="minutes" rows={5} className={input} placeholder={"Ola Adeyemi 90\nOrtiz 65\nSam DNP"} />
          <PendingButton className={btn} pending="Reading…">Read minutes</PendingButton>
        </form>
      )}
    </div>
  );
}
