import type { ProposalRow } from "./store";

// The autonomy ladder.
//   0  Suggest: the agent proposes, the coach decides.            (always available)
//   1  One click for routine suggestions the coach can see together.
//   2  Auto-apply routine suggestions, per rule, only if the coach turns it on after the rule has earned it.
//   3  Never automatic: pain or illness, rest, flags, swaps, increases, anything the limits changed.
// Level 2 is opt-in, earned from the coach's own record, visible every day, undoable, and off per player.

export const WINDOW_DAYS = 28;
export const MIN_DECISIONS = 8;
export const MIN_RATE = 0.9;

// Rules that must always reach the coach: illness, pain, and the player's own "I can't train today".
export const NEVER_AUTOMATIC = new Set(["R6", "R7", "AV"]);

export type RuleStat = { rule: string; decided: number; asProposed: number; rate: number | null; eligible: boolean };

// How the coach has treated each rule's suggestions lately. Only the coach's own decisions count; delegated ones do not vouch for themselves.
export function ruleStats(proposals: ProposalRow[], today: string, ruleIds: string[]): RuleStat[] {
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - WINDOW_DAYS);
  const since = from.toISOString().slice(0, 10);
  return ruleIds.map((rule) => {
    const mine = proposals.filter((p) => p.on_date >= since && p.rules_applied.includes(rule) && (p.status === "approved" || p.status === "rejected") && p.decided_by !== "delegated");
    const asProposed = mine.filter((p) => p.status === "approved" && !p.edited_by_coach).length;
    const rate = mine.length ? asProposed / mine.length : null;
    return { rule, decided: mine.length, asProposed, rate, eligible: !NEVER_AUTOMATIC.has(rule) && mine.length >= MIN_DECISIONS && rate !== null && rate >= MIN_RATE };
  });
}

// A routine suggestion: a plain reduction, nothing flagged, nothing the limits had to change, and no rule that must reach the coach.
export function isRoutine(p: Pick<ProposalRow, "status" | "decision" | "flag" | "edits" | "rules_applied" | "error">): boolean {
  return (
    p.status === "pending" && p.decision === "reduce" && !p.flag && p.edits.length > 0 && !p.error &&
    p.rules_applied.length > 0 && !p.rules_applied.some((r) => NEVER_AUTOMATIC.has(r))
  );
}

export type Autonomy = { delegated: string[]; paused: boolean };
export const NO_AUTONOMY: Autonomy = { delegated: [], paused: false };

// Whether the agent may apply this suggestion without asking: every rule behind it was turned on, none has lost its record, the club is
// not paused, and the coach has not asked to always be asked about this player.
export function mayAutoApply(p: Parameters<typeof isRoutine>[0], a: Autonomy, stats: RuleStat[], askAlways: boolean): boolean {
  if (a.paused || askAlways || !isRoutine(p)) return false;
  return p.rules_applied.every((r) => a.delegated.includes(r) && stats.find((s) => s.rule === r)?.eligible === true);
}
