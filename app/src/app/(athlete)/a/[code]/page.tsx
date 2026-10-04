import { notFound } from "next/navigation";
import { claimDevice, deleteMyData, disconnectPolar, giveConsent, logRpe, previewWearable, submitCheckin, syncPolarNow } from "@/actions/athlete";
import { Live } from "@/components/Live";
import { PendingButton } from "@/components/Pending";
import { Pills } from "@/components/Pills";
import { SessionTable } from "@/components/SessionTable";
import { Steps } from "@/components/Steps";
import { btn, btnGhost, Card, Chip, Eyebrow, input, Notice } from "@/components/ui";
import { ago, dateLabel, decisionCopy } from "@/lib/copy";
import { isLinkOwner } from "@/lib/player-auth";
import { polarEnabled } from "@/lib/polar";
import { todayStr } from "@/lib/run-agent";
import { getClub, getPolarLink, getPulse } from "@/lib/store";
import { athleteToday } from "@/lib/views";
import { PREVIEW, providerName } from "@/lib/wearables";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata() {
  return { title: "Your session" };
}

export default async function AthleteView(props: PageProps<"/a/[code]">) {
  const { code } = await props.params;
  const today = todayStr();
  const { polar: polarResult } = await props.searchParams;
  const v = await athleteToday(code, today);
  if (!v) notFound();
  const [pulse, polarLink, club] = await Promise.all([getPulse(v.athlete.club, `a_${code}`), polarEnabled() ? getPolarLink(code) : Promise.resolve(null), getClub(v.athlete.club)]);
  const { athlete, session, changed, checkin, readiness, proposal, status, week, rpeToday, prev } = v;
  const first = athlete.name.split(" ")[0];
  const preview = !process.env.JUNCTION_API_KEY && process.env.NODE_ENV !== "production";

  if (!athlete.consented_at) {
    return (
      <div className="space-y-5 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Hi {first}</h1>
        <p className="text-[15px] leading-relaxed">{club?.name ?? "Your club"} uses RepReady to adjust your sessions using your daily check-in. Before your first check-in, this is what happens with your answers.</p>
        <Card className="space-y-2 p-4 text-sm leading-relaxed">
          <p>Your coach sees what you enter: sleep, soreness, stress, any notes, and how hard sessions felt. If you connect a Polar device, we also read your sleep and heart-rate variability from Polar Flow, and you can disconnect any time.</p>
          <p>A fixed set of written rules reads those numbers to suggest a change to your session. No outside AI service receives your answers. Your coach approves or rejects the suggestion, or has told the system to apply routine small reductions for them, which they can take back. Pain or illness is never changed automatically. You only see the session your coach has approved.</p>
          <p className="text-muted">Sleep and soreness are health information. This is a pilot. You can delete everything yourself from this page at any time.</p>
        </Card>
        <form action={giveConsent} className="space-y-4">
          <input type="hidden" name="code" value={code} />
          <label className="flex items-start gap-3 text-[15px]"><input type="checkbox" name="agree" value="yes" required className="mt-1 h-4 w-4" />I understand and agree.</label>
          <PendingButton className={`${btn} w-full py-3`} pending="One moment…">Continue</PendingButton>
        </form>
      </div>
    );
  }

  if (!(await isLinkOwner(athlete))) {
    if (!athlete.device_token) {
      return (
        <div className="space-y-5 pt-4">
          <h1 className="text-3xl font-semibold tracking-tight">Hi {first}</h1>
          <p className="text-[15px] leading-relaxed">Use this phone for RepReady? Your link works on one phone. Press Continue to make this the phone your check-ins come from.</p>
          <form action={claimDevice}>
            <input type="hidden" name="code" value={code} />
            <PendingButton className={`${btn} w-full py-3`} pending="One moment…">Continue</PendingButton>
          </form>
        </div>
      );
    }
    return (
      <div className="space-y-3 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">This link is in use on another phone</h1>
        <p className="text-[15px] leading-relaxed text-muted">Each link works on one phone so nobody can check in for someone else. If you changed phone, ask your coach to reset your link, then open it again.</p>
      </div>
    );
  }

  if (!athlete.approved) {
    return (
      <div className="space-y-3 pt-4">
        <Live scope={`a_${code}`} initial={pulse} />
        <h1 className="text-2xl font-semibold tracking-tight">Waiting for {club?.name ?? "your club"}</h1>
        <p className="text-[15px] leading-relaxed text-muted">Staff need to confirm you are in the squad. This page updates by itself once they do. You do not need to do anything else.</p>
      </div>
    );
  }

  const decided = proposal && (proposal.status === "approved" || proposal.status === "rejected");
  const active = !checkin ? 0 : status === "adjusted" || status === "kept_plan" || status === "on_plan" ? 3 : 1;
  const sentDecision = proposal?.status === "approved" ? decisionCopy(proposal.decision) : null;
  const rest = proposal?.status === "approved" && proposal.decision === "rest";

  return (
    <div className="space-y-6">
      <Live scope={`a_${code}`} initial={pulse} />
      <header className="space-y-2 pt-1">
        <div className="flex items-center justify-between"><Eyebrow>{dateLabel(today)}</Eyebrow></div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{session ? session.label : "No session today"}</h1>
        <p className="text-sm text-muted">{athlete.name}{athlete.group ? ` · ${athlete.group}` : ""}{session?.week_type === "deload" ? " · deload week" : ""}</p>
      </header>

      {session && <Steps steps={["Check in", "Coach reviews", "Session ready"]} active={active} warn={status === "agent_error"} />}

      {!session && <Card className="p-5 text-sm text-muted">Nothing is scheduled for you today. Your coach will add the next session.</Card>}

      {session && !checkin && week.every((d) => !d.checked) && (
        <Card className="space-y-1 p-4 text-sm">
          <div className="font-medium">First time here</div>
          <p className="text-muted">It takes under a minute. Answer the questions, send them, and your coach sees them. Add this page to your home screen (Share, then Add to Home Screen) so it is one tap each morning.</p>
        </Card>
      )}

      {session && !checkin && (
        <form action={submitCheckin} className="space-y-5">
          <input type="hidden" name="code" value={code} />
          <Eyebrow>Check in</Eyebrow>
          <Card className="space-y-5 p-5">
            <div>
              <div className="mb-2 text-sm font-medium">Can you train today?</div>
              <div className="flex flex-wrap gap-2 text-sm">
                {([["full", "Yes, as planned"], ["limited", "Limited"], ["out", "No"]] as const).map(([v, label]) => (
                  <label key={v} className="cursor-pointer rounded-md border border-line-strong bg-surface px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-on-brand">
                    <input type="radio" name="availability" value={v} defaultChecked={v === "full"} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {readiness?.sleep_h != null ? (
              <div>
                <div className="text-sm font-medium">Hours slept last night</div>
                <p className="mt-1 text-[15px]">From {providerName(readiness.provider)}: <span className="font-mono tabular-nums">{readiness.sleep_h} h</span>. Right?</p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-muted">No, change it</summary>
                  <label htmlFor="sleep_override" className="mt-2 block text-muted">Hours you actually slept</label>
                  <input id="sleep_override" name="sleep_override" type="number" inputMode="decimal" step="0.1" min="0" max="16" className={`${input} mt-1 max-w-32 text-base`} />
                </details>
                <input type="hidden" name="sleep_h" value={readiness.sleep_h} />
              </div>
            ) : (
              <div>
                <label htmlFor="sleep_h" className="block text-sm font-medium">Hours slept last night</label>
                <input id="sleep_h" name="sleep_h" type="number" inputMode="decimal" step="0.5" min="0" max="16" required placeholder="e.g. 7.5" className={`${input} mt-2 max-w-32 text-base`} />
              </div>
            )}
            <div>
              <div className="mb-2 text-sm font-medium">Soreness</div>
              <Pills name="soreness" from={0} to={10} labelFrom="None" labelTo="Severe" />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Stress</div>
              <Pills name="stress" from={0} to={10} labelFrom="None" labelTo="Severe" />
            </div>
            <div>
              <label htmlFor="note" className="block text-sm font-medium">Anything your coach should know <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="note" name="note" rows={3} maxLength={500} className={`${input} mt-2 text-base`} />
            </div>
            <PendingButton className={`${btn} w-full py-3`} pending="Sending…">Send check-in</PendingButton>
          </Card>
        </form>
      )}

      {session && checkin && (
        <Card className="p-4">
          {status === "analysing" && <p className="text-sm"><span className="font-medium">Thanks, {v.athlete.name.split(" ")[0]}. Got it.</span> Reading your numbers now. This page updates by itself.</p>}
          {status === "needs_decision" && <p className="text-sm"><span className="font-medium">Your coach is reviewing a suggested change.</span> Check back before you train. This page updates by itself.</p>}
          {status === "agent_error" && <p className="text-sm"><span className="font-medium">Your check-in is in.</span> No suggestion came back, so your coach will look at it. Train to the plan unless they say otherwise.</p>}
          {status === "on_plan" && <p className="text-sm"><span className="font-medium">All good.</span> Nothing to change. Train to the plan.</p>}
          {status === "kept_plan" && <p className="text-sm"><span className="font-medium">Your coach kept the plan.</span>{proposal?.coach_note ? ` “${proposal.coach_note}”` : ""}</p>}
          {status === "adjusted" && sentDecision && (
            <div className="space-y-1">
              <div className="flex items-center gap-2"><Chip tone="marker">From your coach</Chip></div>
              <p className="text-[15px] font-medium">{sentDecision.athlete}</p>
              {proposal?.coach_note && <p className="text-sm">“{proposal.coach_note}”</p>}
              {proposal?.reason && !proposal.edited_by_coach && <p className="text-sm text-muted">{proposal.reason}</p>}
            </div>
          )}
        </Card>
      )}

      {session && (
        <section className="space-y-3">
          <Eyebrow>Today’s session</Eyebrow>
          <SessionTable planned={session.exercises} edits={proposal?.status === "approved" ? proposal.edits : []} muted={rest} pictures tags={Object.fromEntries(Object.keys(changed).map((n) => [n, "Changed for you by your coach"]))} />
          {Object.keys(changed).length > 0 && <p className="text-xs text-muted">Your coach has set a personal change to this session for you. It is not a decision by the app.</p>}
          {proposal?.status === "pending" && <p className="text-xs text-muted">Shown as planned. It may change once your coach decides.</p>}
        </section>
      )}

      {session && checkin && (decided || status === "on_plan") && (
        <Card className="space-y-3 p-5">
          <div>
            <div className="text-sm font-medium">After you train</div>
            <p className="text-xs text-muted">How hard was the session? 1 is easy, 10 is all you had.</p>
          </div>
          <form action={logRpe} className="space-y-3">
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="date" value={today} />
            <Pills name="rpe" from={1} to={10} defaultValue={rpeToday !== null ? Math.round(rpeToday) : null} />
            <PendingButton className={btnGhost} pending="Saving…">{rpeToday !== null ? "Update" : "Save"}</PendingButton>
            {rpeToday !== null && <span className="ml-3 text-xs text-ok">Saved: {rpeToday} / 10. Your coach can see it.</span>}
          </form>
        </Card>
      )}

      {prev && (
        <Card className="space-y-3 p-5">
          <div className="text-sm font-medium">Last session: {prev.label}</div>
          <p className="text-xs text-muted">{dateLabel(prev.on_date)}. How hard was it?</p>
          <form action={logRpe} className="space-y-3">
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="date" value={prev.on_date} />
            <Pills name="rpe" from={1} to={10} />
            <PendingButton className={btnGhost} pending="Saving…">Save</PendingButton>
          </form>
        </Card>
      )}

      {polarResult === "connected" && <Notice tone="ok">Polar is connected. Your last night is in.</Notice>}
      {polarResult === "denied" && <Notice>Polar was not connected. You can try again any time.</Notice>}
      {polarResult === "error" && <Notice tone="bad">We could not finish connecting Polar. Try again in a minute.</Notice>}

      {polarEnabled() ? (
        polarLink ? (
          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Polar connected</div>
              <Chip tone={polarLink.error ? "bad" : "ok"}>{polarLink.error ? "Needs attention" : "Linked"}</Chip>
            </div>
            {readiness?.provider === "polar" ? (
              <div className="font-mono text-sm tabular-nums">{readiness.sleep_h ?? "–"} h sleep · HRV {readiness.hrv_ms ?? "–"} · lowest HR {readiness.resting_hr ?? "–"}</div>
            ) : (
              <p className="text-sm text-muted">No sleep for today yet. Sync your device in the Polar Flow app, then press Sync.</p>
            )}
            {polarLink.error && <p className="text-sm text-bad">{polarLink.error} <a className="underline underline-offset-4" href={`/api/polar/connect?code=${code}`}>Reconnect</a></p>}
            <p className="text-xs text-muted">{polarLink.last_synced_at ? `Last synced ${ago(polarLink.last_synced_at)}.` : "Not synced yet."} It also syncs when you check in.</p>
            <div className="flex flex-wrap gap-2">
              <form action={syncPolarNow}><input type="hidden" name="code" value={code} /><PendingButton className={btnGhost} pending="Syncing…">Sync now</PendingButton></form>
              <form action={disconnectPolar}><input type="hidden" name="code" value={code} /><PendingButton className={btnGhost} pending="Disconnecting…">Disconnect</PendingButton></form>
            </div>
          </Card>
        ) : (
          <Card className="space-y-3 p-4">
            <div>
              <h2 className="text-sm font-medium">Connect your Polar</h2>
              <p className="mt-1 text-xs text-muted">We read last night’s sleep and heart-rate variability from Polar Flow, so you type less and your coach sees what your device saw. You can disconnect any time.</p>
            </div>
            <a href={`/api/polar/connect?code=${code}`} className={btn}>Connect Polar</a>
          </Card>
        )
      ) : (
        <>
          {readiness && (
            <Card className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-muted">{providerName(readiness.provider)}</span>
              <span className="font-mono tabular-nums">{readiness.sleep_h ?? "–"} h · HRV {readiness.hrv_ms ?? "–"} · RHR {readiness.resting_hr ?? "–"}</span>
            </Card>
          )}
          {!readiness && preview && (
            <form action={previewWearable} className="space-y-3 rounded-xl border border-dashed border-line-strong p-4">
              <div>
                <h2 className="text-sm font-medium">Connect a wearable</h2>
                <p className="mt-1 text-xs text-muted">Preview with sample data. Live connection is not switched on yet.</p>
              </div>
              <input type="hidden" name="code" value={code} />
              <label htmlFor="provider" className="sr-only">Device</label>
              <select id="provider" name="provider" className={input} defaultValue="whoop">
                {Object.keys(PREVIEW).map((p) => <option key={p} value={p}>{providerName(p)}</option>)}
              </select>
              <PendingButton className={btnGhost} pending="Adding…">Use a sample night</PendingButton>
            </form>
          )}
        </>
      )}

      <section className="space-y-3">
        <Eyebrow>This week</Eyebrow>
        <div className="flex gap-1.5" aria-label="Check-ins this week">
          {week.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <span className={`flex h-8 w-full items-center justify-center rounded-md text-xs ${d.checked ? "bg-brand text-on-brand" : "border border-dashed border-line-strong text-muted"}`}>{d.checked ? "✓" : ""}</span>
              <span className="font-mono text-[10px] text-muted">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "narrow", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <details className="rounded-xl border border-line bg-surface">
          <summary className="disclosure cursor-pointer px-4 py-3 text-sm font-medium text-muted hover:text-ink">Delete my data</summary>
          <form action={deleteMyData} className="space-y-3 border-t border-line px-4 py-4">
            <input type="hidden" name="code" value={code} />
            <Notice>This removes your check-ins, session logs, device data and your coach’s notes about you. It cannot be undone.</Notice>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5" />Yes, delete everything.</label>
            <PendingButton className={btnGhost} pending="Deleting…">Delete my data</PendingButton>
          </form>
        </details>
      </section>
    </div>
  );
}
