import { notFound } from "next/navigation";
import { applyEdits, type ShownExercise } from "@/lib/agent/apply";
import { todayStr } from "@/lib/run-agent";
import { getAthlete, getProposal, getReadiness, getSessionLogs, hasCheckin, sessionBefore, sessionOn, type ReadinessRow } from "@/lib/store";
import { PREVIEW, providerName } from "@/lib/wearables";
import { giveConsent, previewWearable, submitCheckin } from "../../actions";

export const dynamic = "force-dynamic";

const input = "w-full rounded-md border border-line bg-card px-3 py-2.5 outline-none focus:border-accent";
const btn = "w-full rounded-md bg-accent px-5 py-3 text-sm font-medium text-[#f4f2ec] hover:opacity-90 dark:text-[#111210]";

export default async function AthletePage(props: PageProps<"/a/[code]">) {
  const { code } = await props.params;
  const a = await getAthlete(code);
  if (!a) notFound();
  const today = todayStr();

  if (!a.consented_at) {
    return (
      <main className="mx-auto max-w-md space-y-5 py-10">
        <header>
          <p className="text-sm text-muted">Before your first check-in</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Hi {a.name}</h1>
        </header>
        <p className="text-sm leading-relaxed">Your coach will see your sleep, soreness, stress and any note. An AI model reads them and may suggest a change to today&apos;s session. Your coach approves any change before you see it.</p>
        <p className="text-sm leading-relaxed text-muted">Sleep and soreness are health information. This is a pilot. Ask your coach if you want your answers removed.</p>
        <form action={giveConsent} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" value="yes" required className="mt-0.5" /><span>I understand and agree.</span></label>
          <button className={btn}>Continue</button>
        </form>
      </main>
    );
  }

  const [session, checkin, prev, proposal, wearable] = await Promise.all([
    sessionOn(today),
    hasCheckin(code, today),
    sessionBefore(today),
    getProposal(code, today),
    getReadiness(code, today),
  ]);
  const prevLogged = prev ? (await getSessionLogs(code, [prev.on_date])).has(prev.on_date) : false;

  if (!session) {
    return (
      <main className="mx-auto max-w-md py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hi {a.name}</h1>
        <p className="mt-3 text-sm text-muted">No session is scheduled for today.</p>
      </main>
    );
  }

  const planned = session.exercises;
  const approved = proposal?.status === "approved";
  const shown: ShownExercise[] = approved ? applyEdits(planned, proposal.edits) : planned.map((e) => ({ ...e }));
  let status = "";
  if (checkin) {
    if (proposal?.status === "pending") status = "Your coach is reviewing a suggested change. Check back before you train.";
    else if (approved) status = "Your coach adjusted today's session.";
    else if (proposal?.status === "rejected") status = "Your coach kept the planned session.";
    else status = "Planned session, no change.";
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-8 py-8">
      <header>
        <p className="text-sm text-muted">{a.name}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{session.label}</h1>
        <p className="mt-1 text-sm text-muted">{today}{session.week_type === "deload" ? " · deload week" : ""}</p>
      </header>

      {wearable ? <WearableStrip w={wearable} /> : (
        <form action={previewWearable} className="space-y-3 rounded-lg border border-line bg-card p-4">
          <div>
            <h2 className="text-sm font-medium">Connect a wearable</h2>
            <p className="mt-1 text-sm text-muted">WHOOP, Garmin, Oura, Fitbit or Polar. One login covers all of them.</p>
          </div>
          <input type="hidden" name="code" value={code} />
          <label htmlFor="provider" className="sr-only">Device</label>
          <select id="provider" name="provider" className={input} defaultValue="whoop">
            {Object.keys(PREVIEW).map((p) => <option key={p} value={p}>{providerName(p)}</option>)}
          </select>
          <button className={btn}>Use last night</button>
        </form>
      )}

      {!checkin && (
        <form action={submitCheckin} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Check in</h2>
          <Field id="sleep_h" label="Hours slept last night" type="number" extra={{ step: "0.5", min: "0", max: "16" }} />
          <Field id="soreness" label="Soreness, 0 none to 10 severe" extra={{ min: "0", max: "10" }} />
          <Field id="stress" label="Stress, 0 none to 10 severe" extra={{ min: "0", max: "10" }} />
          {prev && !prevLogged && (
            <Field id="last_rpe" label={`How hard was ${prev.label} on ${prev.on_date}? RPE 1 to 10, optional`} required={false} extra={{ step: "0.5", min: "1", max: "10" }} />
          )}
          <div>
            <label htmlFor="note" className="mb-1 block text-sm font-medium">Anything your coach should know, optional</label>
            <textarea id="note" name="note" rows={3} maxLength={500} className={input} />
          </div>
          <button className={btn}>Send check-in</button>
        </form>
      )}

      {checkin && (
        <div className="rounded-lg border border-line bg-card px-4 py-3 text-sm leading-relaxed">
          <p>{status}</p>
          {approved && proposal.reason && <p className="mt-2 text-muted">{proposal.reason}</p>}
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">Today&apos;s session</h2>
        <ul className="mt-3 space-y-2">
          {shown.map((e, i) => (
            <li key={i} className="rounded-lg border border-line bg-card px-4 py-3">
              <div className="font-medium">{e.name}</div>
              <div className="mt-0.5 text-sm text-muted">{e.sets} × {e.reps} · {e.load}{e.target_rpe != null ? ` · target RPE ${e.target_rpe}` : ""}</div>
              {e.note && <div className="mt-1 text-sm text-accent">{e.note}</div>}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function WearableStrip({ w }: { w: ReadinessRow }) {
  const cells = [
    w.sleep_h != null ? ["Sleep", `${w.sleep_h}h`] : null,
    w.hrv_ms != null ? ["HRV", `${w.hrv_ms}`] : null,
    w.resting_hr != null ? ["Resting HR", `${w.resting_hr}`] : null,
  ].filter((c): c is [string, string] => c !== null);
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-muted">{providerName(w.provider)}</h2>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {cells.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-line bg-card px-3 py-3">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="mt-1 text-lg font-medium tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Field({ id, label, required = true, type = "number", extra }: { id: string; label: string; required?: boolean; type?: string; extra?: Record<string, string> }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input id={id} name={id} type={type} required={required} className={input} {...extra} />
    </div>
  );
}
