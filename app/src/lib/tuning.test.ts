import { describe, expect, it } from "vitest";
import { DEFAULTS, looserStep, readThresholds } from "./agent/thresholds";
import { suggestions } from "./tuning";
import type { ProposalRow } from "./store";

const p = (i: number, status: ProposalRow["status"], rules = ["R1"], extra: Partial<ProposalRow> = {}) =>
  ({ id: `p${i}`, on_date: "2026-09-28", rules_applied: rules, status, decided_by: null, ...extra }) as ProposalRow;
const none = { changed_at: {}, snoozed_until: {} };

describe("thresholds", () => {
  it("steps one way only, inside the safe range", () => {
    expect(looserStep("R1_sleep", 6)).toBe(5.5);
    expect(looserStep("R1_sleep", 5)).toBeNull();
    expect(looserStep("R3_soreness", 8)).toBe(9);
    expect(looserStep("R3_soreness", 9)).toBeNull();
  });
  it("never trusts a stored value that is unreadable or out of range", () => {
    expect(readThresholds({ R1_sleep: 3, R2_over: "x", R3_soreness: 8, R4_stress: 100 })).toEqual({ ...DEFAULTS, R3_soreness: 8 });
    expect(readThresholds(null)).toEqual(DEFAULTS);
  });
});

describe("suggestions", () => {
  const kept = (n: number, ofTotal: number, rules = ["R1"]) => Array.from({ length: ofTotal }, (_, i) => p(i, i < n ? "rejected" : "approved", rules));
  it("offers one looser step when most of a rule's suggestions were kept", () => {
    const s = suggestions(kept(6, 9), DEFAULTS, "2026-10-04", none);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ rule: "R1", from: 6, to: 5.5, kept: 6, decided: 9 });
    expect(s[0].text).toContain("sleep below 5.5 h");
  });
  it("stays quiet with too few decisions, a mostly approved record, or a rule that was a team effort", () => {
    expect(suggestions(kept(6, 7), DEFAULTS, "2026-10-04", none)).toEqual([]);
    expect(suggestions(kept(2, 10), DEFAULTS, "2026-10-04", none)).toEqual([]);
    expect(suggestions(kept(9, 9, ["R1", "R2"]), DEFAULTS, "2026-10-04", none)).toEqual([]);
  });
  it("ignores what the agent decided for itself, and decisions from before the rule last changed", () => {
    const agent = Array.from({ length: 10 }, (_, i) => p(i, "rejected", ["R1"], { decided_by: "delegated" }));
    expect(suggestions(agent, DEFAULTS, "2026-10-04", none)).toEqual([]);
    expect(suggestions(kept(8, 9), DEFAULTS, "2026-10-04", { changed_at: { R1_sleep: "2026-10-01T00:00:00Z" }, snoozed_until: {} })).toEqual([]);
  });
  it("respects a snooze, and stops at the end of the safe range", () => {
    expect(suggestions(kept(8, 9), DEFAULTS, "2026-10-04", { changed_at: {}, snoozed_until: { R1_sleep: "2026-10-10" } })).toEqual([]);
    expect(suggestions(kept(8, 9), { ...DEFAULTS, R1_sleep: 5 }, "2026-10-04", none)).toEqual([]);
  });
});
