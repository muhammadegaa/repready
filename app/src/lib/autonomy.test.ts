import { describe, expect, it } from "vitest";
import { isRoutine, mayAutoApply, ruleStats } from "./autonomy";
import type { ProposalRow } from "./store";

type Routine = Parameters<typeof isRoutine>[0];
const base: Routine = { decision: "reduce", flag: null, edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }], rules_applied: ["R1"], error: null, status: "pending" };
const decided = (i: number, status: ProposalRow["status"], extra: Partial<ProposalRow> = {}) =>
  ({ id: `p${i}`, on_date: "2026-09-25", rules_applied: ["R1"], status, edited_by_coach: false, decided_by: null, ...extra }) as ProposalRow;

describe("isRoutine", () => {
  it("is a plain reduction with nothing flagged", () => expect(isRoutine(base)).toBe(true));
  it("is never routine when flagged, errored, or about pain, illness or availability", () => {
    expect(isRoutine({ ...base, flag: "x" })).toBe(false);
    expect(isRoutine({ ...base, error: "limits removed" })).toBe(false);
    expect(isRoutine({ ...base, rules_applied: ["R7"] })).toBe(false);
    expect(isRoutine({ ...base, rules_applied: ["R1", "R6"] })).toBe(false);
    expect(isRoutine({ ...base, rules_applied: ["AV"] })).toBe(false);
  });
  it("is never routine for rest, swaps, increases or flags-only", () => {
    for (const d of ["rest", "swap", "increase", "flag_only", "none"]) expect(isRoutine({ ...base, decision: d as Routine["decision"] })).toBe(false);
  });
  it("is not routine once decided", () => expect(isRoutine({ ...base, status: "approved" })).toBe(false));
});

describe("ruleStats", () => {
  it("earns eligibility from the coach's own record: enough decisions, nine in ten as proposed", () => {
    const ps = [...Array.from({ length: 9 }, (_, i) => decided(i, "approved")), decided(9, "rejected")];
    const s = ruleStats(ps, "2026-10-03", ["R1"])[0];
    expect(s).toMatchObject({ decided: 10, asProposed: 9, eligible: true });
  });
  it("does not count approvals the coach edited, rejections as agreement, or too few decisions", () => {
    const edited = Array.from({ length: 10 }, (_, i) => decided(i, "approved", { edited_by_coach: i < 3 }));
    expect(ruleStats(edited, "2026-10-03", ["R1"])[0].eligible).toBe(false); // 7 of 10 as proposed
    expect(ruleStats(edited.slice(0, 5), "2026-10-03", ["R1"])[0].eligible).toBe(false); // too few
  });
  it("ignores decisions the agent made for itself, and old ones", () => {
    const ps = [...Array.from({ length: 10 }, (_, i) => decided(i, "approved", { decided_by: "delegated" })), decided(20, "approved", { on_date: "2026-06-01" })];
    expect(ruleStats(ps, "2026-10-03", ["R1"])[0].decided).toBe(0);
  });
  it("never makes pain, illness or availability eligible", () => {
    const ps = Array.from({ length: 12 }, (_, i) => decided(i, "approved", { rules_applied: ["R7"] }));
    expect(ruleStats(ps, "2026-10-03", ["R7"])[0].eligible).toBe(false);
  });
});

describe("mayAutoApply", () => {
  const earned = [{ rule: "R1", decided: 10, asProposed: 10, rate: 1, eligible: true }];
  const on = { delegated: ["R1"], paused: false };
  it("applies only when every rule is turned on and still earned, nothing is paused, and the player is not marked always-ask", () => {
    expect(mayAutoApply(base, on, earned, false)).toBe(true);
    expect(mayAutoApply(base, { ...on, paused: true }, earned, false)).toBe(false);
    expect(mayAutoApply(base, on, earned, true)).toBe(false);
    expect(mayAutoApply(base, { delegated: [], paused: false }, earned, false)).toBe(false);
    expect(mayAutoApply(base, on, [{ ...earned[0], eligible: false }], false)).toBe(false);
    expect(mayAutoApply({ ...base, rules_applied: ["R1", "R2"] }, on, earned, false)).toBe(false);
  });
});
