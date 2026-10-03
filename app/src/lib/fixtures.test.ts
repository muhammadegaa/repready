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

import { readFixtureDates } from "./fixtures";

describe("reading a fixture list as a coach has it", () => {
  const today = "2026-10-03";
  it("reads the common ways of writing a date, with opponents and venues around them", () => {
    const r = readFixtureDates([
      "Sat 11 Oct v Reading (H)",
      "Tuesday 14th October - Cup, away at Stoke",
      "2026-10-24",
      "01/11/2026 Derby (A)",
      "Nov 8 Leeds",
      "15 Nov 2026",
    ].join("\n"), today);
    expect(r.dates).toEqual(["2026-10-11", "2026-10-14", "2026-10-24", "2026-11-01", "2026-11-08", "2026-11-15"]);
    expect(r.unreadable).toEqual([]);
  });
  it("reads day first for numeric dates, and two-digit years", () => {
    expect(readFixtureDates("03/10/26\n12/10/2026", today).dates).toEqual(["2026-10-03", "2026-10-12"]);
  });
  it("puts a year-less date in the next year when it has clearly passed", () => {
    expect(readFixtureDates("Sat 14 Feb", today).dates).toEqual(["2027-02-14"]);
    expect(readFixtureDates("Sat 20 Sep", today).dates).toEqual(["2026-09-20"]); // a recent match stays in this year
  });
  it("reports lines it could not read and ignores impossible dates, without losing the good ones", () => {
    const r = readFixtureDates("Sat 11 Oct\nlooking forward to a good run\n31 Feb 2026\n18 Oct", today);
    expect(r.dates).toEqual(["2026-10-11", "2026-10-18"]);
    expect(r.unreadable).toEqual(["looking forward to a good run"]);
  });
  it("de-duplicates and sorts", () => {
    expect(readFixtureDates("18 Oct\n11 Oct\n18 Oct v X", today).dates).toEqual(["2026-10-11", "2026-10-18"]);
  });
});
