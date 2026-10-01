import { describe, expect, it } from "vitest";
import { agrees, summarize } from "./score";
import type { Exercise } from "./schema";

const planned: Exercise[] = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
];

describe("agrees", () => {
  it("accepts volume within 10 points", () => {
    const exp = { decision: "reduce", edits: [{ kind: "set_sets" as const, exercise: "Back squat", to: 3 }] };
    const act = { decision: "reduce", edits: [{ kind: "set_reps" as const, exercise: "Back squat", to: 4 }, { kind: "set_sets" as const, exercise: "Back squat", to: 3 }] };
    expect(agrees(exp, act, planned)).toBe(false); // 75% vs 60%
    expect(agrees(exp, { decision: "reduce", edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }] }, planned)).toBe(true);
  });
  it("rejects a different decision or a different set of exercises", () => {
    const exp = { decision: "reduce", edits: [{ kind: "set_sets" as const, exercise: "Back squat", to: 3 }] };
    expect(agrees(exp, { decision: "none", edits: [] }, planned)).toBe(false);
    expect(agrees(exp, { decision: "reduce", edits: [{ kind: "set_sets", exercise: "Split squat", to: 2 }] }, planned)).toBe(false);
  });
  it("treats two no-edit decisions of the same kind as agreement", () => {
    expect(agrees({ decision: "none", edits: [] }, { decision: "none", edits: [] }, planned)).toBe(true);
    expect(agrees({ decision: "flag_only", edits: [] }, { decision: "rest", edits: [] }, planned)).toBe(false);
  });
  it("compares swaps by exercise", () => {
    const swap = (to: string) => ({ decision: "swap", edits: [{ kind: "swap" as const, exercise: "Split squat", to_exercise: to }] });
    expect(agrees(swap("Step-up"), swap("Step-up"), planned)).toBe(true);
    expect(agrees(swap("Step-up"), { decision: "swap", edits: [{ kind: "swap", exercise: "Back squat", to_exercise: "Box squat" }] }, planned)).toBe(false);
  });
});

describe("summarize", () => {
  it("reports overall, do-nothing and holdout agreement, ignoring unlabeled rows", () => {
    const s = summarize([
      { expected: "none", agree: true, holdout: false },
      { expected: "none", agree: false, holdout: false },
      { expected: "reduce", agree: true, holdout: true },
      { expected: null, agree: null, holdout: true },
    ]);
    expect(s).toEqual({ labeled: 3, agreement: 66.7, do_nothing_agreement: 50, holdout_agreement: 100 });
  });
  it("returns null when nothing is labeled", () => {
    expect(summarize([{ expected: null, agree: null, holdout: false }]).agreement).toBeNull();
  });
});
