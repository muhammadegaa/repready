import { describe, expect, it } from "vitest";
import { cellsFor, squadShare, trendOf, type Answer } from "./squadmap";

const a = (sleep_h: number, soreness: number, stress: number): Answer => ({ sleep_h, soreness, stress });
const steady = Array.from({ length: 10 }, () => a(7.5, 3, 3));

describe("cellsFor", () => {
  it("marks a day usual when it sits inside the player's own range", () => {
    const c = cellsFor(steady);
    expect(c.every((x) => x.level === "usual")).toBe(true);
  });
  it("marks one measure outside their range as watch and two as off, with the reason", () => {
    const watch = cellsFor([...steady, a(5, 3, 3)]);
    expect(watch[10].level).toBe("watch");
    expect(watch[10].notes[0]).toMatch(/^sleep 5 h/);
    const off = cellsFor([...steady, a(5, 8, 3)]);
    expect(off[10].level).toBe("off");
  });
  it("is not fooled by its own bad night, and is not alarmed by a good one", () => {
    const c = cellsFor([...steady, a(9.5, 0, 0)]);
    expect(c[10].level).toBe("usual"); // better than usual is not a concern
  });
  it("says building when there are fewer than five other answers, and none for a missing day", () => {
    const c = cellsFor([a(7, 3, 3), a(7, 3, 3), null, a(4, 9, 9)]);
    expect(c.map((x) => x.level)).toEqual(["building", "building", "none", "building"]);
  });
});

describe("trendOf", () => {
  it("is worse when the last three days sit above the three before, quiet with no answers, otherwise steady", () => {
    const worse = cellsFor([...steady, a(7.5, 3, 3), a(7.5, 3, 3), a(7.5, 3, 3), a(5, 8, 8), a(5, 8, 8), a(5, 8, 8)]);
    expect(trendOf(worse)).toBe("worse");
    expect(trendOf(cellsFor([...steady, null, null, null]))).toBe("quiet");
    expect(trendOf(cellsFor([null, null, null, null, null, null, null, null]))).toBe("steady"); // never answered: new, not quiet
    expect(trendOf(cellsFor(steady))).toBe("steady");
  });
});

describe("squadShare", () => {
  it("counts who answered and how many were off their usual", () => {
    const rows = [cellsFor([...steady, a(5, 3, 3)]), cellsFor([...steady, a(7.5, 3, 3)]), cellsFor([...steady, null])];
    expect(squadShare(rows, 10)).toEqual({ answered: 2, off: 1 });
  });
});
