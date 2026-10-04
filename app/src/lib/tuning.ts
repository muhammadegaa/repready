import { keyOfRule, looserStep, TUNABLE, type TKey, type Thresholds } from "./agent/thresholds";
import type { ProposalRow } from "./store";

// "You keep the plan for most of this rule's suggestions: loosen it one step?" Only that, only one step, only inside the safe range,
// only from the coach's own decisions since the rule last changed. It describes and offers. Nothing changes until the coach says yes.
export const MIN_DECIDED = 8;
export const KEPT_SHARE = 0.6;
export const SNOOZE_DAYS = 14;
export const WINDOW = 28;

export type Suggestion = { key: TKey; rule: string; from: number; to: number; kept: number; decided: number; text: string };

export function suggestions(
  proposals: ProposalRow[], t: Thresholds, today: string,
  meta: { changed_at: Record<string, string>; snoozed_until: Record<string, string> },
): Suggestion[] {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - WINDOW);
  const windowStart = d.toISOString().slice(0, 10);
  const out: Suggestion[] = [];
  for (const rule of ["R1", "R2", "R3", "R4"]) {
    const key = keyOfRule(rule)!;
    if ((meta.snoozed_until[key] ?? "") > today) continue;
    const since = [windowStart, (meta.changed_at[key] ?? "").slice(0, 10)].sort().pop()!;
    // Only suggestions where this rule was the whole reason, so the answer is about this rule and not its neighbour.
    const mine = proposals.filter((p) => p.on_date >= since && p.rules_applied.length === 1 && p.rules_applied[0] === rule && (p.status === "approved" || p.status === "rejected") && p.decided_by !== "delegated");
    const kept = mine.filter((p) => p.status === "rejected").length;
    if (mine.length < MIN_DECIDED || kept / mine.length < KEPT_SHARE) continue;
    const to = looserStep(key, t[key]);
    if (to === null) continue;
    const u = TUNABLE[key];
    out.push({
      key, rule, from: t[key], to, kept, decided: mine.length,
      text: `You kept the plan for ${kept} of the last ${mine.length} ${rule} suggestions. Fire ${rule} only for ${u.label} ${to}${u.unit} instead of ${t[key]}${u.unit}?`,
    });
  }
  return out;
}
