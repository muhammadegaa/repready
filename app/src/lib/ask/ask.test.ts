import { describe, expect, it } from "vitest";
import type { Ask, AskOpts } from "../read/model";
import { findPlayer, needsMe, notIn, respond, whyFlagged, type Person } from "./respond";
import { systemPrompt, understand, type Understood } from "./understand";

const person = (code: string, name: string, over: Partial<Person> = {}): Person => ({ code, name, status: "on_plan", statusLabel: "On plan", proposal: null, exercises: ["Back squat", "Box jump"], ...over });
const squad = [
  person("a", "Jo Mensah", { status: "needs_decision", proposal: { id: "p1", decision: "reduce", reason: "Slept under 6 hours two nights running.", rules: ["R1"], flag: null, edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }], status: "pending" } }),
  person("b", "Luis Ortiz", { status: "waiting" }),
  person("c", "Sam Reid", { status: "needs_decision", proposal: { id: "p2", decision: "flag_only", reason: "Knee pain noted.", rules: ["R7"], flag: "Pain note: clear before training.", edits: [], status: "pending" } }),
  person("d", "Ana Reid", { status: "waiting" }),
];
const u = (o: Partial<Understood>): Understood => ({ intent: "unclear", player: null, exercise: null, max_sets: null, max_reps: null, load_pct: null, swap_to: null, until: null, review_on: null, date: null, minutes: null, ...o });
const today = "2026-10-04";

describe("what the model is given", () => {
  it("never receives a player's name, and the code it echoes is turned back into the name", async () => {
    const seen: AskOpts<unknown>[] = [];
    const fake: Ask = (async (o: AskOpts<unknown>) => { seen.push(o); return u({ intent: "why_flagged", player: o.user.match(/\[N\d+\]/)![0] }); }) as Ask;
    const out = await understand(fake, { sentence: "Why was Jo Mensah flagged?", today, names: squad.map((p) => p.name), exercises: ["Back squat"] });
    const sent = `${seen[0].system}\n${seen[0].user}`;
    for (const n of ["Mensah", "Ortiz", "Reid", "Jo", "Sam", "Ana", "Luis"]) expect(sent).not.toContain(n);
    expect(seen[0].user).toMatch(/\[N\d+\]/);
    expect(out.player).toBe("Jo Mensah");
  });
  it("is told the date and the exercises, and to choose unclear when unsure", () => {
    const p = systemPrompt(today, ["Back squat"]);
    expect(p).toContain("Sunday 2026-10-04");
    expect(p).toContain("Back squat");
    expect(p).toMatch(/When unsure, choose unclear/);
  });
});

describe("finding a player", () => {
  it("matches full names, surnames and first names, and never guesses between two", () => {
    expect(findPlayer("Jo Mensah", squad)).toMatchObject({ person: { code: "a" } });
    expect(findPlayer("mensah", squad)).toMatchObject({ person: { code: "a" } });
    expect(findPlayer("Luis", squad)).toMatchObject({ person: { code: "b" } });
    expect(findPlayer("Reid", squad)).toMatchObject({ error: expect.stringContaining("Sam Reid, Ana Reid") });
    expect(findPlayer("S. Reid", squad)).toMatchObject({ person: { code: "c" } });
    expect(findPlayer("Nobody", squad)).toMatchObject({ error: expect.stringContaining("could not find") });
    expect(findPlayer(null, squad)).toMatchObject({ error: expect.stringContaining("Which player") });
  });
});

describe("answers come from stored data", () => {
  it("lists who is waiting, flags first", () => {
    const r = needsMe(squad);
    expect(r).toMatchObject({ kind: "answer", title: "2 waiting for you" });
    expect((r as { lines: string[] }).lines[0]).toContain("Sam Reid: Pain note");
  });
  it("explains one proposal with its rule and edits", () => {
    const r = whyFlagged("Mensah", squad) as { lines: string[] };
    expect(r.lines.join(" ")).toContain("Slept under 6 hours");
    expect(r.lines.join(" ")).toContain("R1");
    expect(r.lines.some((l) => /squat/i.test(l))).toBe(true);
  });
  it("gives a reminder message per player who has not answered", () => {
    const r = notIn(squad) as { reminders: { name: string; message: string }[] };
    expect(r.reminders.map((x) => x.name)).toEqual(["Luis Ortiz", "Ana Reid"]);
    expect(r.reminders[0].message).toContain("Morning Luis");
  });
});

describe("changes are previews, and the same limits apply as on the forms", () => {
  it("minutes: matches names in code, leaves out the unknown, refuses the future and a missing day", () => {
    const ok = respond(u({ intent: "log_minutes", date: "2026-10-03", minutes: [{ player: "Jo Mensah", minutes: 90 }, { player: "Luis Ortiz", minutes: 0 }, { player: "Zed Nobody", minutes: 30 }] }), squad, today);
    expect(ok).toMatchObject({ kind: "confirm", action: { type: "minutes", date: "2026-10-03" } });
    expect((ok as { action: { rows: unknown[] } }).action.rows).toHaveLength(2);
    expect((ok as { lines: string[] }).lines.join(" ")).toContain("Not matched");
    expect(respond(u({ intent: "log_minutes", date: "2026-10-09", minutes: [{ player: "Jo Mensah", minutes: 90 }] }), squad, today)).toMatchObject({ kind: "error" });
    expect(respond(u({ intent: "log_minutes", date: null, minutes: [{ player: "Jo Mensah", minutes: 90 }] }), squad, today)).toMatchObject({ kind: "error" });
  });
  it("plan change: previews a valid one", () => {
    const r = respond(u({ intent: "standing_change", player: "Jo Mensah", exercise: "box jump", max_sets: 2, until: "2026-10-10" }), squad, today);
    expect(r).toMatchObject({ kind: "confirm", action: { type: "override", code: "a", exercise: "Box jump", max_sets: 2, until: "2026-10-10" } });
  });
  it("plan change: refuses a load above the plan, an unknown exercise, an ambiguous player, a past end date, and an empty change", () => {
    const base = { intent: "standing_change" as const, player: "Jo Mensah", exercise: "Box jump", max_sets: 2 };
    expect(respond(u({ ...base, max_sets: null, load_pct: 100 }), squad, today)).toMatchObject({ kind: "error", message: expect.stringContaining("Load must be") });
    expect(respond(u({ ...base, exercise: "Bench press" }), squad, today)).toMatchObject({ kind: "error", message: expect.stringContaining("player's exercises") });
    expect(respond(u({ ...base, player: "Reid" }), squad, today)).toMatchObject({ kind: "error", message: expect.stringContaining("More than one") });
    expect(respond(u({ ...base, until: "2026-10-01" }), squad, today)).toMatchObject({ kind: "error", message: expect.stringContaining("in the past") });
    expect(respond(u({ ...base, max_sets: null }), squad, today)).toMatchObject({ kind: "error" });
  });
  it("anything unclear changes nothing and says what can be asked", () => {
    const r = respond(u({ intent: "unclear" }), squad, today);
    expect(r).toMatchObject({ kind: "error", message: expect.stringContaining("I can say who needs you") });
  });
  it("draft next week is a preview too", () => {
    expect(respond(u({ intent: "draft_next_week" }), squad, today)).toMatchObject({ kind: "confirm", action: { type: "draft" } });
  });
});

import { EXERCISES, PHRASES, SQUAD, TODAY } from "./phrases";
import { INTENTS } from "./understand";

describe("the phrase set used to score a real model", () => {
  it("is well formed: known intents, dates that exist, players from the squad, and enough unclear cases", () => {
    for (const p of PHRASES) {
      expect(INTENTS).toContain(p.intent);
      for (const d of [p.expect?.until, p.expect?.date]) if (d) expect(new Date(`${d}T00:00:00Z`).toISOString().startsWith(d)).toBe(true);
      if (p.expect?.exercise) expect(EXERCISES).toContain(p.expect.exercise);
      if (p.expect?.player) expect(SQUAD.some((n) => n.toLowerCase().includes(p.expect!.player!.toLowerCase()))).toBe(true);
      expect(p.say.length).toBeLessThanOrEqual(500);
    }
    expect(PHRASES.length).toBeGreaterThanOrEqual(50);
    expect(PHRASES.filter((p) => p.intent === "unclear").length).toBeGreaterThanOrEqual(10);
    expect(new Date(`${TODAY}T00:00:00Z`).getUTCDay()).toBe(0);
  });
});
