import type { ProposalRow } from "./store";

export type Results = {
  days: number;
  players: number;
  checkins: number;
  possible: number;
  checkinRate: number | null; // 0..1
  suggestions: number;
  approved: number;
  keptPlan: number;
  pending: number;
  changedByCoach: number;
  medianHoursToDecide: number | null;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// What a pilot club needs to judge the product: do players answer, and does the coach act on what the rules suggest.
export function summarise(input: { days: number; players: number; checkins: number; proposals: ProposalRow[] }): Results {
  const possible = input.players * input.days;
  const real = input.proposals.filter((p) => p.status !== "no_change" && p.status !== "error");
  const decided = real.filter((p) => p.status === "approved" || p.status === "rejected");
  const hours = decided.filter((p) => p.decided_at).map((p) => (Date.parse(p.decided_at!) - Date.parse(p.created_at)) / 3_600_000).filter((h) => h >= 0);
  const m = median(hours);
  return {
    days: input.days,
    players: input.players,
    checkins: input.checkins,
    possible,
    checkinRate: possible ? Math.min(1, input.checkins / possible) : null,
    suggestions: real.length,
    approved: real.filter((p) => p.status === "approved").length,
    keptPlan: real.filter((p) => p.status === "rejected").length,
    pending: real.filter((p) => p.status === "pending").length,
    changedByCoach: real.filter((p) => p.status === "approved" && p.edited_by_coach).length,
    medianHoursToDecide: m === null ? null : Math.round(m * 10) / 10,
  };
}
