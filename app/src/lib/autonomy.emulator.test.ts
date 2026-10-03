import { describe, expect, it } from "vitest";
import { dayStr, runAgentFor, todayStr } from "./run-agent";
import {
  createClubWithOwner, createPlayers, decideProposal, getAutonomy, getProposal, listProposals, replaceSessions, saveCheckin, saveProposal, setAskAlways, setAutonomy, undoDelegated,
} from "./store";

// Needs the Firestore emulator: npm run test:emulator
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("the autonomy ladder (Firestore emulator)", () => {
  const run = Date.now().toString(36);
  const today = todayStr();

  async function club(name: string) {
    const made = await createClubWithOwner(`${name} ${run}`, { email: `${name.toLowerCase().replace(/\W/g, "")}-${run}@example.com`, name: "Coach", pw: "x" });
    const id = made!.club.id;
    const code = (await createPlayers(id, [{ name: "Delegate Player", shirt: null, position: "", squad: "First team" }]))[0];
    await replaceSessions(id, [{ on_date: today, label: "Lower", week_type: "normal", exercises: [{ name: "Back squat", sets: 4, reps: 5, load: "85%", target_rpe: 8 }] }]);
    return { id, code };
  }
  // Nine earlier suggestions for rule R1, all approved as proposed by the coach, plus one kept: the record that earns the right.
  async function earnR1(id: string, code: string) {
    for (let i = 2; i <= 11; i++) {
      const d = dayStr(today, i);
      await saveProposal({ athlete_code: code, athlete_name: "Delegate Player", session_label: "Lower", on_date: d, decision: "reduce", edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }], reason: "r", rules_applied: ["R1"], flag: null, status: "pending", error: null, created_at: `${d}T07:00:00.000Z`, decided_at: null });
      await decideProposal(id, `${code}_${d}`, i === 11 ? "rejected" : "approved", { by: "coach" });
    }
  }
  const shortSleep = async (code: string) => {
    await saveCheckin(code, dayStr(today, 1), { sleep_h: 5, soreness: 3, stress: 3, note: null });
    await saveCheckin(code, today, { sleep_h: 5.2, soreness: 3, stress: 3, note: null });
  };

  it("applies a routine suggestion itself once the coach has handed over a rule that has earned it, and it can be taken back", async () => {
    const { id, code } = await club("Auto FC");
    await earnR1(id, code);
    await setAutonomy(id, { delegated: ["R1"], paused: false });
    await shortSleep(code);
    await runAgentFor(code, today);
    const p = await getProposal(code, today);
    expect(p).toMatchObject({ status: "approved", decided_by: "delegated", rules_applied: ["R1"] });
    expect(await undoDelegated(id, `${code}_${today}`)).toBe(true);
    expect((await getProposal(code, today))?.status).toBe("rejected");
    expect(await undoDelegated(id, `${code}_${today}`)).toBe(false); // only once
  });

  it("leaves it for the coach when the rule is not handed over, the club is paused, the player is always-ask, or the rule has not earned it", async () => {
    for (const [name, setup] of [
      ["Off FC", async () => {}],
      ["Paused FC", async (id: string) => setAutonomy(id, { delegated: ["R1"], paused: true })],
      ["Ask FC", async (id: string, code: string) => { await setAutonomy(id, { delegated: ["R1"], paused: false }); await setAskAlways(code, true); }],
    ] as const) {
      const { id, code } = await club(name);
      await earnR1(id, code);
      await setup(id, code);
      await shortSleep(code);
      await runAgentFor(code, today);
      expect((await getProposal(code, today))?.status, name).toBe("pending");
    }
    const { id, code } = await club("Unearned FC");
    await setAutonomy(id, { delegated: ["R1"], paused: false }); // handed over, but no record
    await shortSleep(code);
    await runAgentFor(code, today);
    expect((await getProposal(code, today))?.status).toBe("pending");
  });

  it("never applies a pain note itself, even when every rule is handed over", async () => {
    const { id, code } = await club("Pain FC");
    await earnR1(id, code);
    await setAutonomy(id, { delegated: ["R1", "R7", "AV"], paused: false });
    await saveCheckin(code, today, { sleep_h: 5, soreness: 3, stress: 3, note: "sharp pain in my knee" });
    await runAgentFor(code, today);
    expect((await getProposal(code, today))?.status).toBe("pending");
    expect((await getAutonomy(id)).delegated).toContain("R7"); // stored, but ignored
    expect((await listProposals(id, 50)).some((p) => p.decided_by === "delegated" && p.on_date === today)).toBe(false);
  });
});
