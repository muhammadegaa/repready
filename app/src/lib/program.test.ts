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

describe("groups in the program", () => {
  const h = "date,label,week_type,exercise,sets,reps,load,target_rpe,group";
  it("reads an optional group column; rows without one are for everyone", () => {
    const { sessions, errors } = parseProgram([
      h,
      "2026-10-05,Lower,normal,Back squat,4,5,85% 1RM,8,",
      "2026-10-05,Lower,normal,Back squat,5,5,85% 1RM,8,Reserves",
      "2026-10-05,Lower,normal,Nordics,3,5,BW,8,Reserves",
    ].join("\n"));
    expect(errors).toEqual([]);
    expect(sessions).toHaveLength(2);
    expect(sessions.find((s) => s.group === null)?.exercises).toHaveLength(1);
    expect(sessions.find((s) => s.group === "Reserves")?.exercises).toHaveLength(2);
  });
  it("still accepts the original eight columns", () => {
    expect(parseProgram([header, "2026-10-05,Lower,normal,Back squat,4,5,85% 1RM,8"].join("\n")).sessions[0].group).toBeNull();
  });
  it("treats Everyone, All and blank as no group, and merges names that differ only in case", () => {
    const { sessions } = parseProgram([h, "2026-10-05,A,normal,X,3,5,,,Everyone", "2026-10-05,A,normal,Y,3,5,,,reserves", "2026-10-05,A,normal,Z,3,5,,,Reserves"].join("\n"));
    expect(sessions.map((s) => s.group)).toEqual([null, "reserves"]);
    expect(sessions[1].exercises).toHaveLength(2);
  });
  it("rejects an over-long group name with its row", () => {
    expect(parseProgram([h, `2026-10-05,A,normal,X,3,5,,,${"g".repeat(31)}`].join("\n")).errors[0]).toMatch(/Row 2.*group/);
  });
});
