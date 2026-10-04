import { describe, expect, it } from "vitest";
import { clamp01, mondayOf, ringGeometry, runs, scale, shares, weekDates } from "./charts";

describe("chart helpers", () => {
  it("scales a value and allows a reversed range", () => {
    expect(scale(0, 10, 0, 100)(5)).toBe(50);
    expect(scale(9, 4, 10, 110)(9)).toBe(10); // top of the domain is the top of the chart
    expect(scale(9, 4, 10, 110)(4)).toBe(110);
  });

  it("breaks the line at a missing day", () => {
    expect(runs([7, 7.2, null, 6, null, null, 5, 5.5])).toEqual([[0, 1], [3], [6, 7]]);
    expect(runs([null, null])).toEqual([]);
    expect(runs([])).toEqual([]);
  });

  it("measures how much of the ring is filled, and never goes outside it", () => {
    const g = ringGeometry(18, 24, 38);
    expect(g.off / g.c).toBeCloseTo(0.25, 5);
    expect(ringGeometry(30, 24, 38).off).toBe(0);
    expect(ringGeometry(0, 24, 38).off).toBeCloseTo(ringGeometry(0, 24, 38).c, 5);
    expect(ringGeometry(5, 0, 38).off).toBeCloseTo(ringGeometry(5, 0, 38).c, 5); // nobody to check in: empty, not NaN
    expect(clamp01(-1)).toBe(0);
  });

  it("finds Monday and the seven days of a week", () => {
    expect(mondayOf("2026-10-04")).toBe("2026-09-28"); // a Sunday belongs to the week that began on the Monday before
    expect(mondayOf("2026-10-05")).toBe("2026-10-05");
    expect(weekDates("2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
  });

  it("splits a bar into shares that add up", () => {
    expect(shares([3, 1, 0]).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5);
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});
