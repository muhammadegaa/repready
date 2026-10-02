import { describe, expect, it } from "vitest";
import { inviteMessage, parsePlayers } from "./squad";

describe("parsePlayers", () => {
  it("reads name, shirt, position and squad from commas or tabs and defaults the squad", () => {
    const r = parsePlayers("name,number,position,squad\nJ. Mensah, 5, Centre-back\nL. Ortiz\t9\tForward\tU21\nSam");
    expect(r.errors).toEqual([]);
    expect(r.players).toEqual([
      { name: "J. Mensah", shirt: 5, position: "Centre-back", squad: "First team" },
      { name: "L. Ortiz", shirt: 9, position: "Forward", squad: "U21" },
      { name: "Sam", shirt: null, position: "", squad: "First team" },
    ]);
  });
  it("reports the line of a bad row and adds nobody", () => {
    const r = parsePlayers("A, 5\nB, 120\n, 3");
    expect(r.players).toEqual([]);
    expect(r.errors).toEqual(["Line 2: shirt number must be 1 to 99 or empty.", "Line 3: a name of 1 to 80 characters is needed."]);
  });
  it("limits one paste to 60 players", () => {
    const r = parsePlayers(Array.from({ length: 61 }, (_, i) => `P${i}`).join("\n"));
    expect(r.errors).toEqual(["Add at most 60 players at a time."]);
  });
});

describe("inviteMessage", () => {
  it("uses the first name and carries the link", () => {
    const m = inviteMessage("Jo Smith", "https://x.test/a/abc");
    expect(m.startsWith("Hi Jo,")).toBe(true);
    expect(m).toContain("https://x.test/a/abc");
  });
});
