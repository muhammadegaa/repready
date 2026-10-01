import { describe, expect, it } from "vitest";
import { AGENT_LIMITS, COACH_LIMITS, buildEdits } from "./edits";

const planned = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
];
const form = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("buildEdits", () => {
  it("returns no edits when nothing changed", () => {
    expect(buildEdits(form({}), planned, COACH_LIMITS)).toEqual({ edits: [], error: null });
  });
  it("builds sets, reps, load and swap edits", () => {
    const r = buildEdits(form({ sets_0: "3", load_0: "90", swap_1: "Step-up" }), planned, COACH_LIMITS);
    expect(r.error).toBeNull();
    expect(r.edits).toEqual([
      { kind: "set_sets", exercise: "Back squat", to: 3 },
      { kind: "set_load_pct", exercise: "Back squat", to_pct_of_planned: 90 },
      { kind: "swap", exercise: "Split squat", to_exercise: "Step-up" },
    ]);
  });
  it("lets the coach cut deeper than the agent cap", () => {
    expect(buildEdits(form({ sets_0: "2" }), planned, COACH_LIMITS).error).toBeNull();
    expect(buildEdits(form({ sets_0: "2" }), planned, AGENT_LIMITS).error).toMatch(/more than 25%/);
  });
  it("rejects increases, non-integers and bad loads", () => {
    expect(buildEdits(form({ sets_0: "5" }), planned, COACH_LIMITS).error).toMatch(/above the plan/);
    expect(buildEdits(form({ reps_0: "2.5" }), planned, COACH_LIMITS).error).toMatch(/whole numbers/);
    expect(buildEdits(form({ load_0: "120" }), planned, COACH_LIMITS).error).toMatch(/percent of plan/);
    expect(buildEdits(form({ load_0: "40" }), planned, COACH_LIMITS).error).toMatch(/percent of plan/);
  });
});
