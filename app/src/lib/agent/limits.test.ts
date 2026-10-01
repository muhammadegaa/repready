import { describe, expect, it } from "vitest";
import { enforceLimits } from "./limits";
import type { Exercise, Proposal } from "./schema";

const planned: Exercise[] = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
];
const none = { injuryFlaggedExercises: [], clearedExercises: [] };
const proposal = (edits: Proposal["edits"], reason = "Two short nights of sleep."): Proposal => ({
  decision: "reduce",
  edits,
  reason,
  rules_applied: ["R1"],
});

describe("enforceLimits", () => {
  it("accepts a reduction within 25%", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_sets", exercise: "Back squat", to: 3 }]), none);
    expect(v.accepted).toHaveLength(1);
    expect(v.rejected).toHaveLength(0);
  });

  it("rejects a reduction beyond 25%", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_sets", exercise: "Back squat", to: 2 }]), none);
    expect(v.accepted).toHaveLength(0);
    expect(v.rejected[0].why).toMatch(/more than 25%/);
  });

  it("rejects raising sets above the plan", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_sets", exercise: "Back squat", to: 5 }]), none);
    expect(v.rejected[0].why).toMatch(/above the plan/);
  });

  it("rejects load above 100% of planned", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_load_pct", exercise: "Back squat", to_pct_of_planned: 105 }]), none);
    expect(v.rejected).toHaveLength(1);
  });

  it("accepts a load cut of 10%", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_load_pct", exercise: "Back squat", to_pct_of_planned: 90 }]), none);
    expect(v.accepted).toHaveLength(1);
  });

  it("counts sets and reps reductions together against the cap", () => {
    const v = enforceLimits(
      planned,
      proposal([
        { kind: "set_sets", exercise: "Back squat", to: 3 },
        { kind: "set_reps", exercise: "Back squat", to: 4 },
      ]),
      none,
    );
    expect(v.accepted).toHaveLength(1);
    expect(v.rejected).toHaveLength(1);
  });

  it("rejects edits to an injury-flagged exercise unless the coach cleared it", () => {
    const edit = [{ kind: "set_sets" as const, exercise: "Back squat", to: 3 }];
    const blocked = enforceLimits(planned, proposal(edit), { injuryFlaggedExercises: ["Back squat"], clearedExercises: [] });
    expect(blocked.accepted).toHaveLength(0);
    const cleared = enforceLimits(planned, proposal(edit), { injuryFlaggedExercises: ["Back squat"], clearedExercises: ["Back squat"] });
    expect(cleared.accepted).toHaveLength(1);
  });

  it("rejects an exercise that is not in the session", () => {
    const v = enforceLimits(planned, proposal([{ kind: "set_sets", exercise: "Deadlift", to: 2 }]), none);
    expect(v.rejected[0].why).toMatch(/not in the planned session/);
  });

  it("allows a swap", () => {
    const v = enforceLimits(planned, proposal([{ kind: "swap", exercise: "Back squat", to_exercise: "Box squat" }]), none);
    expect(v.accepted).toHaveLength(1);
  });

  it("flags medical language in the reason", () => {
    expect(enforceLimits(planned, proposal([], "This will treat your knee injury."), none).reasonOk).toBe(false);
    expect(enforceLimits(planned, proposal([], "This helps prevent injury."), none).reasonOk).toBe(false);
    expect(enforceLimits(planned, proposal([], "Sleep was under 6h for two nights."), none).reasonOk).toBe(true);
  });
});
