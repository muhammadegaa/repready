import { describe, expect, it } from "vitest";
import { isActive, overrideEdits, resolvePlan, validateOverride, type Override } from "./overrides";

const plan = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
  { name: "Nordic hamstring curl", sets: 3, reps: 5, load: "BW", target_rpe: 8 },
];
const ov = (o: Partial<Override>): Override => ({
  id: "o1", athlete_code: "abc123aaaaaaaaaa", exercise: "Back squat", swap_to: null, max_sets: null, max_reps: null, load_pct: null,
  until: null, review_on: null, note: "", created_at: "2026-10-01T10:00:00Z", created_by: "Coach", lifted_at: null, ...o,
});

describe("override edits", () => {
  it("caps only reduce: a cap above the planned number changes nothing", () => {
    expect(overrideEdits(ov({ max_sets: 3 }), plan)).toEqual([{ kind: "set_sets", exercise: "Back squat", to: 3 }]);
    expect(overrideEdits(ov({ max_sets: 6, max_reps: 9 }), plan)).toEqual([]);
    expect(overrideEdits(ov({ exercise: "Nordic hamstring curl", max_sets: 3 }), plan)).toEqual([]); // already 3
  });
  it("swaps and lowers load, and ignores sessions without the exercise", () => {
    expect(overrideEdits(ov({ swap_to: "Box squat", load_pct: 80 }), plan)).toEqual([
      { kind: "set_load_pct", exercise: "Back squat", to_pct_of_planned: 80 },
      { kind: "swap", exercise: "Back squat", to_exercise: "Box squat" },
    ]);
    expect(overrideEdits(ov({ exercise: "Bench press", swap_to: "Push-up" }), plan)).toEqual([]);
  });
  it("matches the exercise name without regard to case", () => {
    expect(overrideEdits(ov({ exercise: "back SQUAT", max_sets: 2 }), plan)).toHaveLength(1);
  });
});

describe("activity", () => {
  it("is active until lifted or past its end date", () => {
    expect(isActive(ov({}), "2026-10-05")).toBe(true);
    expect(isActive(ov({ until: "2026-10-05" }), "2026-10-05")).toBe(true); // the end date itself still counts
    expect(isActive(ov({ until: "2026-10-04" }), "2026-10-05")).toBe(false);
    expect(isActive(ov({ lifted_at: "2026-10-03T08:00:00Z" }), "2026-10-05")).toBe(false);
  });
});

describe("resolved plan", () => {
  it("applies active overrides and leaves other exercises untouched", () => {
    const r = resolvePlan(plan, [ov({ swap_to: "Box squat", max_sets: 3 })], "2026-10-05");
    expect(r.exercises.map((e) => e.name)).toEqual(["Box squat", "Romanian deadlift", "Nordic hamstring curl"]);
    expect(r.exercises[0].sets).toBe(3);
    expect(r.exercises[1]).toEqual(plan[1]);
    expect([...r.changed.keys()]).toEqual(["Box squat"]);
    expect("note" in r.exercises[0]).toBe(false);
  });
  it("ignores lifted and expired overrides, and lets the newer one win for the same exercise", () => {
    const r = resolvePlan(plan, [
      ov({ id: "old", max_sets: 2, created_at: "2026-10-01T10:00:00Z" }),
      ov({ id: "new", max_sets: 3, created_at: "2026-10-02T10:00:00Z" }),
      ov({ id: "lifted", exercise: "Romanian deadlift", max_sets: 1, lifted_at: "2026-10-03T00:00:00Z" }),
      ov({ id: "expired", exercise: "Nordic hamstring curl", max_sets: 1, until: "2026-10-04" }),
    ], "2026-10-05");
    expect(r.exercises[0].sets).toBe(3);
    expect(r.exercises[1].sets).toBe(3);
    expect(r.exercises[2].sets).toBe(3);
    expect(r.applied.map((o) => o.id)).toEqual(["new"]);
  });
  it("returns the plan unchanged with no overrides", () => {
    const r = resolvePlan(plan, [], "2026-10-05");
    expect(r.exercises).toEqual(plan);
    expect(r.changed.size).toBe(0);
  });
});

describe("validation", () => {
  const input = { exercise: "Back squat", swap_to: "", max_sets: "", max_reps: "", load_pct: "", until: "", review_on: "", note: "" };
  const known = ["Back squat", "Romanian deadlift"];
  const today = "2026-10-03";
  it("needs a known exercise and at least one change", () => {
    expect(validateOverride({ ...input, exercise: "Bench press", swap_to: "x" }, known, today)).toMatchObject({ ok: false });
    expect(validateOverride(input, known, today)).toMatchObject({ ok: false, error: expect.stringMatching(/at least one change/) });
  });
  it("accepts a swap, caps and a load, and cleans them", () => {
    const r = validateOverride({ ...input, exercise: "back squat", swap_to: "  Box   squat ", max_sets: "3", load_pct: "80", until: "2026-10-20", review_on: "2026-10-10", note: " knee " }, known, today);
    expect(r).toMatchObject({ ok: true, value: { exercise: "Back squat", swap_to: "Box squat", max_sets: 3, load_pct: 80, until: "2026-10-20", review_on: "2026-10-10", note: "knee" } });
  });
  it("rejects values that are out of range or dates that make no sense", () => {
    for (const bad of [{ max_sets: "0" }, { max_reps: "x" }, { load_pct: "49" }, { load_pct: "100" }, { swap_to: "x".repeat(61) }, { until: "2026-10-02", swap_to: "a" }, { review_on: "2026-10-01", swap_to: "a" }, { until: "2026-10-05", review_on: "2026-10-09", swap_to: "a" }, { until: "not a date", swap_to: "a" }]) {
      expect(validateOverride({ ...input, swap_to: "a", ...bad }, known, today)).toMatchObject({ ok: false });
    }
  });
});
