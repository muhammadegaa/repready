import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadSampleSquad, removeSampleSquad } from "./sample";
import { dayStr, todayStr } from "./run-agent";
import {
  countSessions, createPlayers, listAthletes, listActiveOverrides, listOverrides, listSampleAthletes, replaceSessions, sessionFor, getCheckins, getProposal, listEvents,
} from "./store";

// Needs the Firestore emulator: npm run test:emulator
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("sample squad (Firestore emulator)", () => {
  // Club ids are six hex characters; a random one keeps the test repeatable against a reused emulator.
  const newClub = () => randomBytes(3).toString("hex");

  it("loads fictional players with groups, history, a plan change and real proposals, then removes only them", async () => {
    const club = newClub();
    const today = todayStr();
    const real = (await createPlayers(club, [{ name: "Real Player", shirt: 7, position: "", squad: "First team" }]))[0];

    const first = await loadSampleSquad(club);
    expect(first).toEqual({ players: 6, program: true });
    expect(await loadSampleSquad(club)).toBe("exists"); // loading twice does nothing

    const all = await listAthletes(club);
    const sample = await listSampleAthletes(club);
    expect(sample).toHaveLength(6);
    expect(all).toHaveLength(7);
    expect(all.find((a) => a.code === real)?.sample).toBe(false);
    expect(sample.map((a) => a.group).sort((a, b) => String(a).localeCompare(String(b)))).toEqual([null, "Reserves", "Reserves", "Starters", "Starters", "Starters"]);
    expect(sample.filter((a) => a.consented_at).length).toBe(5); // Novak has not opened his link yet

    // groups get their own version of Lower strength; everyone else the base
    const okafor = sample.find((a) => a.name === "Okafor")!;
    const mensah = sample.find((a) => a.name === "Mensah")!;
    expect((await sessionFor(club, today, "Reserves"))?.exercises.map((e) => e.name)).toContain("Box jump");
    expect((await sessionFor(club, today, "Starters"))?.exercises.map((e) => e.name)).not.toContain("Box jump");

    // two weeks of answers, so the usual range has something to stand on
    const dates = Array.from({ length: 14 }, (_, i) => dayStr(today, 13 - i));
    expect((await getCheckins(mensah.code, dates)).size).toBeGreaterThanOrEqual(13);

    // the rules ran for real: a pain note is a flag with no edit, and short sleep is a proposal
    const pain = await getProposal(okafor.code, today);
    expect(pain).toMatchObject({ decision: "flag_only", status: "pending" });
    expect(pain?.edits).toEqual([]);
    expect(pain?.rules_applied).toContain("R7");
    expect((await getProposal(mensah.code, today))?.rules_applied).toContain("R1");

    // Reid has a standing plan change in force
    const reid = sample.find((a) => a.name === "Reid")!;
    const active = await listActiveOverrides(reid.code, today);
    expect(active.map((o) => o.exercise)).toEqual(["Nordic hamstring curl"]);

    // removal takes the sample players, their plan changes and the sample program, and nothing else
    expect(await removeSampleSquad(club)).toBe(6);
    expect((await listAthletes(club)).map((a) => a.code)).toEqual([real]);
    expect(await listOverrides(reid.code)).toEqual([]);
    expect(await countSessions(club)).toBe(0);
    expect((await listEvents(club, 50)).filter((e) => /was removed/.test(e.text))).toHaveLength(0); // no clutter
    // and it can be loaded again afterwards
    expect(await loadSampleSquad(club)).toEqual({ players: 6, program: true });
    await removeSampleSquad(club);
  });

  it("never replaces a club's own program", async () => {
    const club = newClub();
    const own = [{ name: "Own lift", sets: 3, reps: 5, load: "RPE 7", target_rpe: 7 }];
    await replaceSessions(club, [{ on_date: todayStr(), label: "Our session", week_type: "normal", exercises: own }]);
    expect(await loadSampleSquad(club)).toEqual({ players: 6, program: false });
    expect(await countSessions(club)).toBe(1);
    expect((await sessionFor(club, todayStr(), null))?.label).toBe("Our session");
    // with the club's own program, the sample players follow it and no plan change is invented for an exercise it lacks
    expect(await removeSampleSquad(club)).toBe(6);
    expect(await countSessions(club)).toBe(1);
  });
});
