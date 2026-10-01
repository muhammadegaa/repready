import { notFound } from "next/navigation";
import db from "@/lib/db";
import { applyEdits, type ShownExercise } from "@/lib/agent/apply";
import type { Edit, Exercise } from "@/lib/agent/schema";
import { todayStr } from "@/lib/run-agent";
import { giveConsent, submitCheckin } from "../../actions";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700";
const btn = "rounded-md bg-teal-700 px-5 py-3 font-medium text-white hover:bg-teal-800 dark:bg-teal-500 dark:text-neutral-950";

export default async function AthletePage(props: PageProps<"/a/[code]">) {
  const { code } = await props.params;
  const a = db.prepare("select id, name, consented_at from athlete where code = ?").get(code) as { id: number; name: string; consented_at: string | null } | undefined;
  if (!a) notFound();
  const today = todayStr();

  if (!a.consented_at) {
    return (
      <main className="mx-auto max-w-md space-y-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">Hi {a.name}</h1>
        <p>Before your first check-in: your coach will see your answers (sleep, soreness, stress and any notes). An AI model, accessed through OpenRouter, reads them to suggest changes to your session. Your coach approves any change before you see it.</p>
        <p className="text-sm text-neutral-500">Sleep and soreness are health information. This is a pilot. Ask your coach if you want your answers removed.</p>
        <form action={giveConsent} className="space-y-3">
          <input type="hidden" name="code" value={code} />
          <label className="flex items-start gap-2"><input type="checkbox" name="agree" value="yes" required className="mt-1" /><span>I understand and agree.</span></label>
          <button className={btn}>Continue</button>
        </form>
      </main>
    );
  }

  const session = db.prepare("select id, label, week_type, exercises from session where on_date = ? order by id limit 1").get(today) as { id: number; label: string; week_type: string; exercises: string } | undefined;
  const checkin = db.prepare("select 1 as ok from checkin where athlete_id = ? and on_date = ?").get(a.id, today);
  const prev = db.prepare("select on_date, label from session where on_date < ? order by on_date desc limit 1").get(today) as { on_date: string; label: string } | undefined;
  const prevLogged = prev ? db.prepare("select 1 as ok from session_log where athlete_id = ? and on_date = ?").get(a.id, prev.on_date) : undefined;
  const proposal = db.prepare("select status, edits, reason from proposal where athlete_id = ? and on_date = ?").get(a.id, today) as { status: string; edits: string; reason: string | null } | undefined;

  if (!session) {
    return <main className="mx-auto max-w-md px-4 py-8"><h1 className="text-2xl font-semibold">Hi {a.name}</h1><p className="mt-3">No session is scheduled for today.</p></main>;
  }

  const planned = JSON.parse(session.exercises) as Exercise[];
  const approved = proposal?.status === "approved";
  const shown: ShownExercise[] = approved ? applyEdits(planned, JSON.parse(proposal.edits) as Edit[]) : planned.map((e) => ({ ...e }));
  let status = "";
  if (checkin) {
    if (proposal?.status === "pending") status = "Your coach is reviewing a suggested change. Check back before you train.";
    else if (approved) status = `Your coach adjusted today's session.${proposal.reason ? ` ${proposal.reason}` : ""}`;
    else if (proposal?.status === "rejected") status = "Your coach kept the planned session.";
    else status = "Planned session, no change.";
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold">Hi {a.name}</h1>
        <p className="text-neutral-500">{today} · {session.label}{session.week_type === "deload" ? " (deload week)" : ""}</p>
      </header>

      {!checkin && (
        <form action={submitCheckin} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          <h2 className="text-lg font-semibold">Check in</h2>
          <div><label htmlFor="sleep_h" className="mb-1 block text-sm font-medium">Hours slept last night</label><input id="sleep_h" name="sleep_h" type="number" step="0.5" min="0" max="16" required className={input} /></div>
          <div><label htmlFor="soreness" className="mb-1 block text-sm font-medium">Soreness, 0 none to 10 severe</label><input id="soreness" name="soreness" type="number" min="0" max="10" required className={input} /></div>
          <div><label htmlFor="stress" className="mb-1 block text-sm font-medium">Stress, 0 none to 10 severe</label><input id="stress" name="stress" type="number" min="0" max="10" required className={input} /></div>
          {prev && !prevLogged && (
            <div><label htmlFor="last_rpe" className="mb-1 block text-sm font-medium">How hard was {prev.label} on {prev.on_date}? RPE 1 to 10 (optional)</label><input id="last_rpe" name="last_rpe" type="number" step="0.5" min="1" max="10" className={input} /></div>
          )}
          <div><label htmlFor="note" className="mb-1 block text-sm font-medium">Anything your coach should know (optional)</label><textarea id="note" name="note" rows={3} maxLength={500} className={input} /></div>
          <button className={btn}>Send check-in</button>
        </form>
      )}

      {checkin && <p className="rounded-md border border-neutral-300 p-3 dark:border-neutral-700">{status}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Today&apos;s session</h2>
        <ul className="space-y-2">
          {shown.map((e, i) => (
            <li key={i} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="font-medium">{e.name}</div>
              <div className="text-sm">{e.sets} × {e.reps} · {e.load}{e.target_rpe != null ? ` · target RPE ${e.target_rpe}` : ""}</div>
              {e.note && <div className="mt-1 text-sm text-teal-700 dark:text-teal-400">{e.note}</div>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
