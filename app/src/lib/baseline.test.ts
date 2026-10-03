import { describe, expect, it } from "vitest";
import { MIN_DAYS, standing, usualRange } from "./baseline";

describe("usual range", () => {
  it("is each player's own mean plus or minus one standard deviation", () => {
    const u = usualRange([7, 8, 7, 8, 7, 8]);
    expect(u).toEqual({ n: 6, mean: 7.5, low: 7, high: 8 });
  });
  it("needs enough earlier days, and ignores missing ones", () => {
    expect(usualRange([7, 7, 7, 7])).toBeNull();
    expect(usualRange([7, null, 7, null, 7, 7])).toBeNull(); // only four answers
    expect(usualRange([7, null, 7, 7, 7, 7])).not.toBeNull();
    expect(MIN_DAYS).toBe(5);
  });
  it("does not need a particular order or length of history", () => {
    expect(usualRange([5, 6, 7, 8, 9, 5, 6, 7, 8, 9, 7, 7, 7, 7])?.mean).toBe(7);
  });
});

describe("standing against it", () => {
  const u = usualRange([7, 8, 7, 8, 7, 8])!; // 7 to 8
  it("says lower, usual or higher", () => {
    expect(standing(5.4, u)).toBe("lower");
    expect(standing(7.4, u)).toBe("usual");
    expect(standing(7, u)).toBe("usual"); // the edge is inside
    expect(standing(9.2, u)).toBe("higher");
  });
  it("says nothing without today's answer or without a usual range", () => {
    expect(standing(null, u)).toBeNull();
    expect(standing(6, null)).toBeNull();
  });
  it("gives a very steady player room, so a one-point change on a 0 to 10 scale is not called different", () => {
    const flat = usualRange([4, 4, 4, 4, 4, 4], 1)!; // no spread at all
    expect(flat).toMatchObject({ mean: 4, low: 3, high: 5 });
    expect(standing(5, flat)).toBe("usual");
    expect(standing(6, flat)).toBe("higher");
    expect(standing(2, flat)).toBe("lower");
  });
  it("never narrows a player's own spread, and sleep gets half an hour of room", () => {
    expect(usualRange([5, 9, 5, 9, 5, 9], 1)).toMatchObject({ low: 5, high: 9 }); // own spread (2) wins
    expect(usualRange([7, 7, 7, 7, 7, 7], 0.5)).toMatchObject({ low: 6.5, high: 7.5 });
  });
});
