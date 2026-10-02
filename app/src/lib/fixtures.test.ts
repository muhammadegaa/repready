import { describe, expect, it } from "vitest";
import { matchDayTag, parseFixtures } from "./fixtures";

describe("fixtures", () => {
  it("parses dates and rejects junk", () => {
    expect(parseFixtures("2026-10-10, 2026-10-03\n2026-10-10").dates).toEqual(["2026-10-03", "2026-10-10"]);
    expect(parseFixtures("10/10").errors.length).toBe(1);
  });
  it("tags days around a match", () => {
    const f = ["2026-10-10"];
    expect(matchDayTag("2026-10-08", f)).toBe("MD-2");
    expect(matchDayTag("2026-10-10", f)).toBe("MD");
    expect(matchDayTag("2026-10-11", f)).toBe("MD+1");
    expect(matchDayTag("2026-10-01", f)).toBeNull();
  });
  it("prefers the coming match when two are equally close", () => {
    expect(matchDayTag("2026-10-12", ["2026-10-10", "2026-10-14"])).toBe("MD-2");
  });
});
