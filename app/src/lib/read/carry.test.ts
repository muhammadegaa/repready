import { describe, expect, it } from "vitest";
import { carryForward, nextMonday } from "./carry";

const ex = [{ name: "Back squat", sets: 4, reps: 5, load: "85%", target_rpe: 8 }];
const s = (on_date: string, label: string, group: string | null = null, week_type = "normal") => ({ on_date, label, week_type, group, exercises: ex });

describe("nextMonday", () => {
  it("is the Monday strictly after today", () => {
    expect(nextMonday("2026-10-03")).toBe("2026-10-05"); // Saturday
    expect(nextMonday("2026-10-05")).toBe("2026-10-12"); // Monday itself: next week
    expect(nextMonday("2026-10-04")).toBe("2026-10-05"); // Sunday
  });
});

describe("carryForward", () => {
  const week = [s("2026-10-05", "Lower"), s("2026-10-07", "Upper"), s("2026-10-09", "Lower", "Reserves", "deload")];
  it("copies last week a week on, keeping groups and deloads, and notes the matches near it", () => {
    const d = carryForward(week, "2026-10-12", ["2026-10-17"])!;
    expect(d.sessions.map((x) => [x.date, x.label, x.group, x.week_type])).toEqual([
      ["2026-10-12", "Lower", null, "normal"], ["2026-10-14", "Upper", null, "normal"], ["2026-10-16", "Lower", "Reserves", "deload"],
    ]);
    expect(d.sessions.every((x) => x.how === "written")).toBe(true);
    expect(d.notes[1]).toContain("2026-10-16 Lower (Reserves) is MD-1");
  });
  it("says so when no match is in the fixtures, and returns null when there is nothing to copy", () => {
    expect(carryForward(week, "2026-10-12", [])!.notes[1]).toMatch(/No match is in your fixtures/);
    expect(carryForward(week, "2026-10-26", [])).toBeNull();
  });
  it("leaves out sample sessions", () => {
    expect(carryForward([{ ...s("2026-10-05", "Lower"), sample: true }], "2026-10-12", [])).toBeNull();
  });
});
