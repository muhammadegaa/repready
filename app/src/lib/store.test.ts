import { describe, expect, it } from "vitest";
import { countSessions, createAthlete, decideProposal, deleteAthleteData, getAthlete, getCheckins, getNotice, getProposal, getSessionLogs, giveConsentTo, hasCheckin, listAthletes, listProposals, replaceSessions, saveCheckin, saveProposal, saveSessionLog, sessionBefore, sessionOn, sessionsOnDates, setNotice } from "./store";

// Needs the Firestore emulator: npm run test:emulator
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("store (Firestore emulator)", () => {
  const ex = [{ name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 }];

  it("creates an athlete, rejects odd codes, records consent once", async () => {
    const code = await createAthlete("Test Athlete");
    expect(code).toMatch(/^[0-9a-f]{10}$/);
    expect((await getAthlete(code))?.consented_at).toBeNull();
    expect(await getAthlete("not-a-code")).toBeNull();
    expect(await getAthlete("0000000000")).toBeNull();
    await giveConsentTo(code);
    const first = (await getAthlete(code))?.consented_at;
    expect(first).toBeTruthy();
    await giveConsentTo(code);
    expect((await getAthlete(code))?.consented_at).toBe(first);
    expect((await listAthletes()).some((a) => a.code === code)).toBe(true);
  });

  it("replaces sessions and finds them by date", async () => {
    await replaceSessions([
      { on_date: "2030-01-01", label: "A", week_type: "normal", exercises: ex },
      { on_date: "2030-01-03", label: "B", week_type: "deload", exercises: ex },
    ]);
    expect(await countSessions()).toBe(2);
    expect((await sessionOn("2030-01-03"))?.week_type).toBe("deload");
    expect(await sessionOn("2030-01-02")).toBeNull();
    expect((await sessionBefore("2030-01-03"))?.label).toBe("A");
    expect(await sessionBefore("2030-01-01")).toBeNull();
    expect((await sessionsOnDates(["2030-01-01", "2030-01-02", "2030-01-03"])).length).toBe(2);
    await replaceSessions([{ on_date: "2030-02-01", label: "C", week_type: "normal", exercises: ex }]);
    expect(await countSessions()).toBe(1);
  });

  it("stores check-ins and session logs by day", async () => {
    const code = await createAthlete("Logger");
    await saveCheckin(code, "2030-03-01", { sleep_h: 6.5, soreness: 4, stress: 3, note: null });
    expect(await hasCheckin(code, "2030-03-01")).toBe(true);
    expect(await hasCheckin(code, "2030-03-02")).toBe(false);
    const c = await getCheckins(code, ["2030-03-01", "2030-03-02"]);
    expect(c.get("2030-03-01")?.sleep_h).toBe(6.5);
    expect(c.has("2030-03-02")).toBe(false);
    await saveSessionLog(code, "2030-03-01", 8.5);
    expect((await getSessionLogs(code, ["2030-03-01", "2030-03-02"])).get("2030-03-01")).toBe(8.5);
  });

  it("decides a pending proposal once and not again", async () => {
    const code = await createAthlete("Prop");
    await saveProposal({
      athlete_code: code, athlete_name: "Prop", session_label: "A", on_date: "2030-04-01", decision: "reduce",
      edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }], reason: "r", rules_applied: ["R1"], flag: null,
      status: "pending", error: null, created_at: new Date().toISOString(), decided_at: null,
    });
    const id = `${code}_2030-04-01`;
    await decideProposal(id, "approved");
    expect((await getProposal(code, "2030-04-01"))?.status).toBe("approved");
    await decideProposal(id, "rejected");
    expect((await getProposal(code, "2030-04-01"))?.status).toBe("approved");
    expect((await listProposals(10)).some((p) => p.id === id)).toBe(true);
  });

  it("deletes an athlete and everything stored for them, and nobody else's data", async () => {
    const gone = await createAthlete("Gone");
    const stays = await createAthlete("Stays");
    for (const code of [gone, stays]) {
      await saveCheckin(code, "2030-05-01", { sleep_h: 7, soreness: 2, stress: 2, note: null });
      await saveSessionLog(code, "2030-05-01", 7);
      await saveProposal({
        athlete_code: code, athlete_name: code, session_label: "A", on_date: "2030-05-01", decision: "none", edits: [], reason: null,
        rules_applied: [], flag: null, status: "no_change", error: null, created_at: new Date().toISOString(), decided_at: null,
      });
    }
    await deleteAthleteData(gone);
    expect(await getAthlete(gone)).toBeNull();
    expect(await hasCheckin(gone, "2030-05-01")).toBe(false);
    expect((await getSessionLogs(gone, ["2030-05-01"])).size).toBe(0);
    expect(await getProposal(gone, "2030-05-01")).toBeNull();
    expect(await getAthlete(stays)).not.toBeNull();
    expect(await hasCheckin(stays, "2030-05-01")).toBe(true);
    expect(await getProposal(stays, "2030-05-01")).not.toBeNull();
  });

  it("sets and clears a notice", async () => {
    await setNotice("import", "Row 2: bad");
    expect(await getNotice("import")).toBe("Row 2: bad");
    await setNotice("import", null);
    expect(await getNotice("import")).toBeNull();
  });
});
