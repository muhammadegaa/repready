"use client";

import { useActionState } from "react";
import { saveLabelAction } from "@/actions/science";
import type { Exercise } from "@/lib/agent/schema";
import type { Rule } from "@/lib/rules";
import type { LabelRow } from "@/lib/store";
import { btn, input, Notice } from "./ui";
import { PendingButton } from "./Pending";

const DECISIONS: [string, string][] = [
  ["none", "No change"],
  ["reduce", "Reduce volume or load"],
  ["swap", "Swap an exercise"],
  ["rest", "Rest (illness)"],
  ["flag_only", "Flag to coach, no edit"],
  ["increase", "Suggest an increase (flag only)"],
];

export function LabelForm({ id, planned, label, rules }: { id: string; planned: Exercise[]; label: LabelRow | null; rules: Rule[] }) {
  const [state, action] = useActionState(saveLabelAction, null);
  const edit = (name: string, kind: string, key: string) => label?.edits.find((e) => e.exercise === name && e.kind === kind) ? String((label.edits.find((e) => e.exercise === name && e.kind === kind) as unknown as Record<string, unknown>)[key]) : "";

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={id} />
      <div>
        <label htmlFor="decision" className="block text-sm font-medium">Your decision</label>
        <select id="decision" name="decision" required defaultValue={label?.decision ?? ""} className={`${input} mt-1.5 max-w-sm`}>
          <option value="" disabled>Choose</option>
          {DECISIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>

      <div>
        <div className="text-sm font-medium">Edits <span className="font-normal text-muted">(only for Reduce or Swap; empty means unchanged)</span></div>
        <p className="mb-2 text-xs text-muted">Sets and reps can only go down, sets × reps cannot fall below 75% of the plan, load is 75 to 100% of plan. The agent works under the same limits.</p>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[460px] text-sm">
            <thead><tr className="border-b border-line bg-paper text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted"><th className="px-3 py-2 font-medium">Exercise</th><th className="px-3 py-2 font-medium">Sets</th><th className="px-3 py-2 font-medium">Reps</th><th className="px-3 py-2 font-medium">Load %</th><th className="px-3 py-2 font-medium">Swap to</th></tr></thead>
            <tbody>
              {planned.map((e, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-3 py-2">{e.name} <span className="font-mono text-xs text-muted">{e.sets}×{e.reps}</span></td>
                  <td className="px-2 py-1.5"><input name={`sets_${i}`} type="number" min={1} max={e.sets} defaultValue={edit(e.name, "set_sets", "to")} className={`${input} w-16`} aria-label={`Sets for ${e.name}`} /></td>
                  <td className="px-2 py-1.5"><input name={`reps_${i}`} type="number" min={1} max={e.reps} defaultValue={edit(e.name, "set_reps", "to")} className={`${input} w-16`} aria-label={`Reps for ${e.name}`} /></td>
                  <td className="px-2 py-1.5"><input name={`load_${i}`} type="number" min={75} max={100} defaultValue={edit(e.name, "set_load_pct", "to_pct_of_planned")} className={`${input} w-20`} aria-label={`Load percent for ${e.name}`} /></td>
                  <td className="px-2 py-1.5"><input name={`swap_${i}`} type="text" maxLength={60} defaultValue={edit(e.name, "swap", "to_exercise")} className={`${input} min-w-28`} aria-label={`Swap ${e.name} to`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium">Reason, one sentence that cites the inputs</label>
        <textarea id="reason" name="reason" rows={2} maxLength={400} defaultValue={label?.reason ?? ""} className={`${input} mt-1.5`} />
      </div>

      {label ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which rules explain it?</legend>
          <p className="text-xs text-muted">Tick every rule you used. Tick none if the decision comes from something the rules do not cover.</p>
          <div className="space-y-1.5">
            {rules.map((r) => (
              <label key={r.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="rule" value={r.id} defaultChecked={label.rules_applied.includes(r.id)} className="mt-0.5" />
                <span><span className="font-mono text-xs text-muted">{r.id}</span> <span className="font-medium">{r.name}</span><span className="text-muted"> · {r.trigger}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-sm text-muted">Rule tags unlock after you save a decision, so the rule text cannot steer it.</p>
      )}

      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.saved && !state.error && <Notice tone="ok">Saved.</Notice>}
      <PendingButton className={btn} pending="Saving…">{label ? "Update label" : "Save decision"}</PendingButton>
    </form>
  );
}
