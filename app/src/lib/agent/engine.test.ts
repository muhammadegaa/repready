import { describe, expect, it } from "vitest";
import { decide, evaluate } from "./engine";
import type { Scenario } from "./propose";

const ALL = new Set(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
const planned = [
  { name: "Back squat", sets: 4, reps: 5, load: "85%", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70%", target_rpe: 7 },
  { name: "Plank", sets: 3, reps: 3, load: "BW", target_rpe: 6 },
];
const day = (d: number, extra: Record<string, unknown> = {}) => ({ day: d, sleep_h: 7.5, stress: 3, soreness: { overall: 2 }, session: null, note: null, ...extra });
const scn = (days: unknown[], week_type = "normal"): Scenario => ({
  athlete: {}, planned_session: { label: "Lower", week_type, exercises: planned }, last_14_days: days,
});
const quiet = Array.from({ length: 14 }, (_, i) => day(i - 13));

describe("rules engine", () => {
  it("does nothing on a quiet day", () => {
    const r = decide(scn(quiet), ALL);
    expect(r.proposal.decision).toBe("none");
    expect(r.proposal.edits).toEqual([]);
  });

  it("R1 trims volume after two short nights, inside the limits", () => {
    const days = quiet.map((d) => (d.day >= -1 ? { ...d, sleep_h: 5.4 } : d));
    const r = decide(scn(days), ALL);
    expect(r.proposal.decision).toBe("reduce");
    expect(r.proposal.rules_applied).toEqual(["R1"]);
    expect(r.verdict.rejected).toEqual([]);
    expect(r.verdict.accepted.length).toBe(3);
  });

  it("R2 fires on 3 of the last 4 sessions over target", () => {
    const days = quiet.map((d) => ([-9, -7, -5, -3].includes(d.day) ? { ...d, session: { completed: true, rpe_delta: d.day === -9 ? 0 : 2.5 } } : d));
    expect(evaluate(scn(days), ALL).map((f) => f.rule)).toContain("R2");
  });

  it("R6 proposes rest with no edits, and stops other rules", () => {
    const days = quiet.map((d) => (d.day === 0 ? { ...d, note: "fever since last night", sleep_h: 4 } : { ...d, sleep_h: 4 }));
    const r = decide(scn(days), ALL);
    expect(r.proposal.decision).toBe("rest");
    expect(r.proposal.edits).toEqual([]);
    expect(r.proposal.rules_applied).toEqual(["R6"]);
  });

  it("R7 only flags for pain", () => {
    const days = quiet.map((d) => (d.day === 0 ? { ...d, note: "sharp pain in left knee" } : d));
    const r = decide(scn(days), ALL);
    expect(r.proposal.decision).toBe("flag_only");
    expect(r.proposal.edits).toEqual([]);
  });

  it("R10 suppresses reductions in a deload week", () => {
    const days = quiet.map((d) => (d.day >= -1 ? { ...d, sleep_h: 5 } : d));
    expect(decide(scn(days, "deload"), ALL).proposal.decision).toBe("none");
  });

  it("R9 suggests an increase only as a flag", () => {
    const days = quiet.map((d) => ([-9, -7, -5, -3].includes(d.day) ? { ...d, session: { completed: true, rpe_delta: -2.5 } } : d));
    const r = decide(scn(days), ALL);
    expect(r.proposal.decision).toBe("increase");
    expect(r.proposal.edits).toEqual([]);
  });

  it("skips rules the scientist deleted", () => {
    const days = quiet.map((d) => (d.day >= -1 ? { ...d, sleep_h: 5.4 } : d));
    const without = new Set([...ALL].filter((x) => x !== "R1"));
    expect(decide(scn(days), without).proposal.decision).toBe("none");
  });

  it("never edits a protected exercise", () => {
    const days = quiet.map((d) => (d.day >= -1 ? { ...d, sleep_h: 5.4 } : d));
    const r = decide(scn(days), ALL, { injuryFlaggedExercises: ["Back squat"], clearedExercises: [] });
    expect(r.proposal.edits.some((e) => e.exercise === "Back squat")).toBe(false);
  });
});
