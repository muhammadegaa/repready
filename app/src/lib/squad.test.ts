import { describe, expect, it } from "vitest";
import { inviteMessage, readSquad } from "./squad";

describe("readSquad", () => {
  it("reads a header row with columns in any order, positions in coach shorthand, and a group column", () => {
    const r = readSquad("Player\tPos\tNo\tGroup\nJ. Mensah\tCB\t5\tStarters\nL. Ortiz\tST\t9\tReserves\nSam\t\t\t");
    expect(r.skipped).toEqual([]);
    expect(r.players).toEqual([
      { name: "J. Mensah", shirt: 5, position: "Centre-back", squad: "First team", group: "Starters" },
      { name: "L. Ortiz", shirt: 9, position: "Forward", squad: "First team", group: "Reserves" },
      { name: "Sam", shirt: null, position: "", squad: "First team", group: "" },
    ]);
  });
  it("reads without a header by what each cell looks like", () => {
    const r = readSquad("J. Mensah, 5, Centre-back\nL. Ortiz; 9; Forward; U21");
    expect(r.players.map((p) => [p.name, p.shirt, p.position, p.squad])).toEqual([
      ["J. Mensah", 5, "Centre-back", "First team"],
      ["L. Ortiz", 9, "Forward", "U21"],
    ]);
  });
  it("reads a plain list of names, with shirt numbers and positions written around them", () => {
    const r = readSquad("Jo Smith\n7 Ana Cruz\nBen Okafor (GK) #1\nDee Lee - 14");
    expect(r.players.map((p) => [p.name, p.shirt, p.position])).toEqual([
      ["Jo Smith", null, ""], ["Ana Cruz", 7, ""], ["Ben Okafor", 1, "Goalkeeper"], ["Dee Lee", 14, ""],
    ]);
  });
  it("keeps the good lines and lists the ones it cannot use", () => {
    const r = readSquad("name,number\nA,5\nB,120\n,3");
    expect(r.players.map((p) => p.name)).toEqual(["A"]);
    expect(r.skipped).toEqual(["B,120", ",3"]);
  });
  it("limits one paste to 60 players", () => {
    const r = readSquad(Array.from({ length: 61 }, (_, i) => `Player ${String.fromCharCode(65 + (i % 26))}${i}`).join("\n"));
    expect(r.players).toHaveLength(60);
    expect(r.tooMany).toBe(true);
  });
});

describe("inviteMessage", () => {
  it("uses the first name and carries the link", () => {
    const m = inviteMessage("Jo Smith", "https://x.test/a/abc");
    expect(m.startsWith("Hi Jo,")).toBe(true);
    expect(m).toContain("https://x.test/a/abc");
  });
});
