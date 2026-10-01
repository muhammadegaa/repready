import Link from "next/link";
import { approveEdited, approveProposal, keepPlan } from "@/actions/coach";
import { decisionCopy } from "@/lib/copy";
import type { Rule } from "@/lib/rules";
import type { SessionRow } from "@/lib/store";
import { providerName } from "@/lib/wearables";
import type { RosterEntry } from "@/lib/views";
import { PendingButton } from "./Pending";
import { SessionTable } from "./SessionTable";
import { btn, btnGhost, Card, Chip, input, Notice } from "./ui";

export function ProposalCard({ entry, session, rules }: { entry: RosterEntry; session: SessionRow; rules: Rule[] }) {
  const p = entry.proposal!;
  const copy = decisionCopy(p.decision);
  const first = entry.athlete.name.split(" ")[0];
  const sleepDevice = entry.readiness?.sleep_h ?? null;
  const used = p.rules_applied.map((id) => rules.find((r) => r.id === id)).filter((r): r is Rule => Boolean(r));

  return (
    <Card className="overflow-hidden">
      <form>
        <input type="hidden" name="id" value={p.id} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-semibold text-paper">{entry.athlete.name[0]}</span>
            <div>
              <div className="font-semibold leading-tight">{entry.athlete.name}</div>
              <div className="text-xs text-muted">{session.label}</div>
            </div>
          </div>
          <Chip tone="warn">Needs you</Chip>
        </div>

        <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">{copy.title}</h3>
              {p.reason && <p className="mt-1 text-[15px] leading-relaxed">{p.reason}</p>}
            </div>
            <SessionTable planned={session.exercises} edits={p.edits} />
            {p.edits.length === 0 && <p className="text-sm text-muted">No edit to the session is proposed.</p>}
            {p.flag && <Notice>For you: {p.flag}</Notice>}
            {p.error && <p className="text-xs text-muted">{p.error}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">What it saw</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Sleep</dt>
                  <dd className="font-mono tabular-nums">
                    {(sleepDevice ?? entry.checkin?.sleep_h ?? "–")} h
                    {sleepDevice !== null && entry.readiness && <span className="ml-1 text-xs text-muted">{providerName(entry.readiness.provider)}</span>}
                  </dd>
                </div>
                <div><dt className="text-xs text-muted">Soreness</dt><dd className="font-mono tabular-nums">{entry.checkin?.soreness ?? "–"} / 10</dd></div>
                <div><dt className="text-xs text-muted">Stress</dt><dd className="font-mono tabular-nums">{entry.checkin?.stress ?? "–"} / 10</dd></div>
                <div>
                  <dt className="text-xs text-muted">HRV · resting HR</dt>
                  <dd className="font-mono tabular-nums">{entry.readiness?.hrv_ms ?? "–"} · {entry.readiness?.resting_hr ?? "–"}</dd>
                </div>
              </dl>
              {entry.checkin?.note && <blockquote className="mt-3 border-l-2 border-line-strong pl-3 text-sm italic text-muted">“{entry.checkin.note}”</blockquote>}
            </div>
            {used.length > 0 && (
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Rule applied</div>
                <ul className="mt-2 space-y-2">
                  {used.map((r) => (
                    <li key={r.id} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-muted">{r.id}</span> <span className="font-medium">{r.name}</span>
                      <div className="mt-0.5 text-xs text-muted">When {r.trigger.charAt(0).toLowerCase() + r.trigger.slice(1)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 border-t border-line bg-paper px-5 py-4">
          <details className="group">
            <summary className="disclosure cursor-pointer text-sm font-medium text-muted hover:text-ink">Change the numbers yourself</summary>
            <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                    <th className="px-3 py-2 font-medium">Exercise</th><th className="px-3 py-2 font-medium">Sets</th><th className="px-3 py-2 font-medium">Reps</th><th className="px-3 py-2 font-medium">Load %</th><th className="px-3 py-2 font-medium">Swap to</th>
                  </tr>
                </thead>
                <tbody>
                  {session.exercises.map((e, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">{e.name}</td>
                      <td className="px-2 py-1.5"><input name={`sets_${i}`} type="number" min={1} max={e.sets} placeholder={String(e.sets)} className={`${input} w-16`} aria-label={`Sets for ${e.name}`} /></td>
                      <td className="px-2 py-1.5"><input name={`reps_${i}`} type="number" min={1} max={e.reps} placeholder={String(e.reps)} className={`${input} w-16`} aria-label={`Reps for ${e.name}`} /></td>
                      <td className="px-2 py-1.5"><input name={`load_${i}`} type="number" min={50} max={100} placeholder="100" className={`${input} w-20`} aria-label={`Load percent for ${e.name}`} /></td>
                      <td className="px-2 py-1.5"><input name={`swap_${i}`} type="text" maxLength={60} className={`${input} min-w-28`} aria-label={`Swap ${e.name} to`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-3 py-2 text-xs text-muted">Empty means unchanged. You can cut deeper than the agent’s 25% limit. Sets and reps can only go down.</p>
            </div>
            <div className="mt-3"><PendingButton formAction={approveEdited} className={btnGhost} pending="Saving…">Approve with my changes</PendingButton></div>
          </details>
          <details>
            <summary className="disclosure cursor-pointer text-sm font-medium text-muted hover:text-ink">Add a note for {first}</summary>
            <textarea name="note" rows={2} maxLength={300} placeholder={`Shown to ${first} with the session`} className={`${input} mt-3`} aria-label={`Note for ${first}`} />
          </details>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <PendingButton formAction={approveProposal} className={btn} pending="Sending…">{copy.approve}</PendingButton>
            <PendingButton formAction={keepPlan} className={btnGhost} pending="Saving…">Keep my plan</PendingButton>
            <span className="text-xs text-muted">{first} sees only what you send.</span>
            {(p.decision === "flag_only" || p.decision === "rest" || p.flag) && (
              <Link href={`/coach/athletes/${entry.athlete.code}`} className="text-xs font-medium underline underline-offset-4">Protect an exercise for {first}</Link>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
