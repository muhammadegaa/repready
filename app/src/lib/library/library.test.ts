import { describe, expect, it } from "vitest";
import { matchExercise } from "./index";

describe("exercise matching", () => {
  it("finds football staples by alias", () => {
    const m = matchExercise("Nordics");
    expect(m.status).toBe("matched");
    if (m.status === "matched") expect(m.exercise.name).toBe("Nordic hamstring curl");
  });
  it("maps the dataset's barbell full squat to our back squat", () => {
    const m = matchExercise("Barbell Full Squat");
    expect(m.status === "matched" && m.exercise.id).toBe("back-squat");
  });
  it("matches general library names", () => {
    expect(matchExercise("Romanian Deadlift").status).toBe("matched");
  });
  it("only suggests near misses", () => {
    const m = matchExercise("Trap bar deadlifts");
    expect(["matched", "suggested"]).toContain(m.status);
    expect(matchExercise("zzz qqq").status).toBe("none");
  });
});

import { describeReport, resolveProgram } from "./resolve";

describe("resolveProgram", () => {
  const session = (names: string[]) => [{ on_date: "2026-10-05", label: "L", week_type: "normal" as const, exercises: names.map((name) => ({ name, sets: 3, reps: 8, load: "", target_rpe: null })) }];
  it("renames aliases and reports the rest without changing them", () => {
    const { sessions, report } = resolveProgram(session(["Nordics", "zzz qqq"]));
    expect(sessions[0].exercises.map((e) => e.name)).toEqual(["Nordic hamstring curl", "zzz qqq"]);
    expect(report.renamed).toEqual(["Nordics → Nordic hamstring curl"]);
    expect(report.unmatched).toEqual(["zzz qqq"]);
    expect(describeReport(report)).toContain("zzz qqq");
  });
  it("is silent when nothing needs saying", () => {
    expect(describeReport(resolveProgram(session(["Back squat"])).report)).toBeNull();
  });
});
