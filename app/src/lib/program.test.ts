import { describe, expect, it } from "vitest";
import { parseProgram } from "./program";
import { applyEdits } from "./agent/apply";

const header = "date,label,week_type,exercise,sets,reps,load,target_rpe";

describe("parseProgram", () => {
  it("groups rows into sessions by date and label", () => {
    const { sessions, errors } = parseProgram(
      [header, "2026-10-05,Lower,normal,Back squat,4,5,85% 1RM,8", "2026-10-05,Lower,normal,RDL,3,8,70% 1RM,7", "2026-10-07,Upper,deload,Bench press,3,6,70% 1RM,"].join("\n"),
    );
    expect(errors).toEqual([]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].exercises).toHaveLength(2);
    expect(sessions[1].week_type).toBe("deload");
    expect(sessions[1].exercises[0].target_rpe).toBeNull();
  });

  it("reports the row of a bad value and returns no sessions", () => {
    const { sessions, errors } = parseProgram([header, "2026-10-05,Lower,normal,Back squat,four,5,85% 1RM,8"].join("\n"));
    expect(sessions).toEqual([]);
    expect(errors[0]).toMatch(/Row 2/);
  });

  it("rejects a wrong header", () => {
    expect(parseProgram("a,b,c\n1,2,3").errors[0]).toMatch(/First line must be/);
  });
});

describe("applyEdits", () => {
  const planned = [
    { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
    { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
  ];
  it("changes only the edited exercise and notes the change", () => {
    const out = applyEdits(planned, [{ kind: "set_sets", exercise: "Back squat", to: 3 }]);
    expect(out[0].sets).toBe(3);
    expect(out[0].note).toMatch(/sets 4 to 3/);
    expect(out[1]).toEqual(planned[1]);
  });
  it("applies a swap and a load change", () => {
    const out = applyEdits(planned, [
      { kind: "swap", exercise: "Split squat", to_exercise: "Step-up" },
      { kind: "set_load_pct", exercise: "Back squat", to_pct_of_planned: 90 },
    ]);
    expect(out[1].name).toBe("Step-up");
    expect(out[0].load).toBe("90% of 85% 1RM");
  });
});
