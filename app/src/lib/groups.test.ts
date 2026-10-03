import { describe, expect, it } from "vitest";
import { cleanGroup, groupNames, pickSession, sameGroup } from "./groups";

const s = (group: string | null, label = group ?? "base") => ({ group, label });

describe("groups", () => {
  it("cleans what a coach types", () => {
    expect(cleanGroup("  Reserves  ")).toBe("Reserves");
    expect(cleanGroup("first   team")).toBe("first team");
    for (const none of ["", "  ", "Everyone", "all", null, undefined]) expect(cleanGroup(none as string | null)).toBeNull();
    expect(cleanGroup("x".repeat(50))).toHaveLength(30);
  });
  it("compares names without regard to case", () => {
    expect(sameGroup("Reserves", "reserves ")).toBe(true);
    expect(sameGroup("Reserves", "Starters")).toBe(false);
    expect(sameGroup(null, "Everyone")).toBe(true);
  });
  it("gives a player their group's version, else the one for everyone, else nothing", () => {
    const day = [s(null), s("Reserves")];
    expect(pickSession(day, "Reserves")?.label).toBe("Reserves");
    expect(pickSession(day, "reserves")?.label).toBe("Reserves");
    expect(pickSession(day, "Starters")?.label).toBe("base");
    expect(pickSession(day, null)?.label).toBe("base");
    expect(pickSession([s("Reserves")], "Starters")).toBeNull();
    expect(pickSession([s("Reserves")], null)).toBeNull();
    expect(pickSession([], "Reserves")).toBeNull();
  });
  it("lists group names in use, most common first", () => {
    expect(groupNames([{ group: "B" }, { group: "A" }, { group: "A" }, { group: null }], [{ group: "C" }])).toEqual(["A", "B", "C"]);
  });
});
