import { describe, expect, it } from "vitest";
import { readMinutes } from "./minutes";

const squad = [
  { code: "a1", name: "Ola Adeyemi" }, { code: "a2", name: "Jo Mensah" }, { code: "a3", name: "Jon Mensah" },
  { code: "a4", name: "Luis Ortiz" }, { code: "a5", name: "Sam Okafor" },
];

describe("readMinutes", () => {
  it("matches full names, surnames and first names that are unique, in the ways a coach jots them", () => {
    const r = readMinutes("Ola Adeyemi 90\nOrtiz - 65\nSam 20 mins\nL. Ortiz 70'", squad);
    expect(r.rows).toEqual([
      { code: "a1", name: "Ola Adeyemi", minutes: 90 },
      { code: "a4", name: "Luis Ortiz", minutes: 70 }, // the later line for the same player wins
      { code: "a5", name: "Sam Okafor", minutes: 20 },
    ]);
    expect(r.unmatched).toEqual([]);
  });
  it("reads did-not-play as zero minutes", () => {
    expect(readMinutes("Sam DNP\nOla - unused", squad).rows.map((x) => x.minutes)).toEqual([0, 0]);
  });
  it("never guesses between two players: an ambiguous name is listed", () => {
    const r = readMinutes("Mensah 90\nJo Mensah 45", squad);
    expect(r.rows).toEqual([{ code: "a2", name: "Jo Mensah", minutes: 45 }]);
    expect(r.unmatched).toEqual(["Mensah 90"]);
  });
  it("lists lines with no name, no minutes, an unknown player or impossible minutes", () => {
    const r = readMinutes("90\nOla\nNobody 45\nSam 400", squad);
    expect(r.rows).toEqual([]);
    expect(r.unmatched).toHaveLength(4);
  });
});
