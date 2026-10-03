import { describe, expect, it } from "vitest";
import { makeRedactor, withRedaction } from "./redact";

const names = ["Jo Mensah", "Luis Ortiz", "Sam Okafor", "Mark Silva"];

describe("makeRedactor", () => {
  const r = makeRedactor(names);
  it("replaces full names and parts of names, whatever the case", () => {
    const out = r.redact("Mensah: no deep squats. jo mensah and ORTIZ rest. Luis Ortiz again.");
    for (const n of ["Mensah", "mensah", "ORTIZ", "Ortiz", "Luis", "Jo"]) expect(out).not.toContain(n);
    expect(out).toMatch(/\[N\d+\]/);
  });
  it("leaves ordinary words alone, including words that contain a name", () => {
    expect(r.redact("Marker drill, remark on tempo, mark the cones")).toContain("Marker drill, remark on tempo");
  });
  it("puts the names back, inside nested answers", () => {
    const coded = r.redact("Mensah has a knee");
    const answer = { notes: [coded], sessions: [{ label: coded, group: null }], n: 3 };
    expect(r.restore(answer)).toEqual({ notes: ["Mensah has a knee"], sessions: [{ label: "Mensah has a knee", group: null }], n: 3 });
  });
});

describe("withRedaction", () => {
  it("sends the model no names and returns the names restored", async () => {
    let seen = "";
    const fake = (async (o: { system: string; user: string }) => { seen = o.system + o.user; return { notes: [o.user.match(/\[N\d+\][^\n]*/)?.[0]] }; }) as never;
    const ask = withRedaction(fake, names);
    const out = (await ask({ system: "Read it. Jo Mensah is injured.", user: "Okafor trains on Tuesday\nplain", tool: "t", description: "d", schema: {} as never } as never)) as { notes: string[] };
    expect(seen).not.toMatch(/Mensah|Okafor/);
    expect(out.notes[0]).toBe("Okafor trains on Tuesday");
  });
});
