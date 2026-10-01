import { describe, expect, it } from "vitest";
import {
  countSessions, createAthlete, decideProposal, deleteAthleteData, getAthlete, getCheckin, getCheckins, getNotice, getProposal, getPulse, getSessionLogs,
  giveConsentTo, hasCheckin, listAthletes, listEvalRuns, listEvents, listLabels, listProposals, listProposalsFor, listRuleOverrides, listSessions,
  logEvent, replaceSessions, saveCheckin, saveEvalRun, saveLabel, saveProposal, saveRule, saveSessionLog, sessionBefore, sessionOn,
  sessionsOnDates, setNotice, setProtected, touch, saveLead, listLeads, countLeads,
} from "./store";

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

  it("moves the pulse on every write so open views know to refresh", async () => {
    const before = await getPulse("coach");
    await new Promise((r) => setTimeout(r, 5));
    const code = await createAthlete("Pulse");
    const afterAdd = await getPulse("coach");
    expect(afterAdd).toBeGreaterThan(before);
    await new Promise((r) => setTimeout(r, 5));
    await saveCheckin(code, "2030-06-01", { sleep_h: 7, soreness: 1, stress: 1, note: null });
    expect(await getPulse(`a_${code}`)).toBeGreaterThan(0);
    expect(await getPulse("coach")).toBeGreaterThan(afterAdd);
    await touch("science");
    expect(await getPulse("science")).toBeGreaterThan(0);
    expect(await getPulse("a_0000000001")).toBe(0);
  });

  it("keeps an activity feed, newest first", async () => {
    await logEvent({ type: "t", athlete_code: null, athlete_name: null, text: "first" });
    await new Promise((r) => setTimeout(r, 5));
    await logEvent({ type: "t", athlete_code: null, athlete_name: null, text: "second" });
    const ev = await listEvents(50);
    expect(ev.findIndex((e) => e.text === "second")).toBeLessThan(ev.findIndex((e) => e.text === "first"));
  });

  it("protects exercises without duplicates and stores the check-in time", async () => {
    const code = await createAthlete("Protect");
    await setProtected(code, ["Back squat", "Back squat", " Split squat "]);
    expect((await getAthlete(code))?.protected).toEqual(["Back squat", "Split squat"]);
    await saveCheckin(code, "2030-06-02", { sleep_h: 6, soreness: 2, stress: 2, note: "tight" });
    const c = await getCheckin(code, "2030-06-02");
    expect(c?.note).toBe("tight");
    expect(c?.created_at).toBeTruthy();
  });

  it("records the coach's note and edits, and notes the decision in the feed", async () => {
    const code = await createAthlete("Decide");
    await saveProposal({
      athlete_code: code, athlete_name: "Decide", session_label: "A", on_date: "2030-07-01", decision: "reduce",
      edits: [{ kind: "set_sets", exercise: "Back squat", to: 3 }], reason: "r", rules_applied: ["R1"], flag: null,
      status: "pending", error: null, created_at: new Date().toISOString(), decided_at: null,
    });
    const id = `${code}_2030-07-01`;
    const d = await decideProposal(id, "approved", { note: " go easy ", edits: [{ kind: "set_sets", exercise: "Back squat", to: 2 }] });
    expect(d?.edited_by_coach).toBe(true);
    const p = await getProposal(code, "2030-07-01");
    expect(p?.coach_note).toBe("go easy");
    expect(p?.edits).toEqual([{ kind: "set_sets", exercise: "Back squat", to: 2 }]);
    expect(await decideProposal(id, "rejected")).toBeNull();
    expect((await listProposalsFor(code, 5)).length).toBe(1);
    expect((await listEvents(50)).some((e) => e.text.includes("approved with changes for Decide"))).toBe(true);
  });

  it("lists upcoming sessions in date order", async () => {
    await replaceSessions([
      { on_date: "2031-01-03", label: "C", week_type: "normal", exercises: ex },
      { on_date: "2031-01-01", label: "A", week_type: "normal", exercises: ex },
      { on_date: "2030-12-30", label: "Past", week_type: "normal", exercises: ex },
    ]);
    expect((await listSessions("2031-01-01", 10)).map((x) => x.label)).toEqual(["A", "C"]);
  });

  it("saves rules, labels and evaluation runs", async () => {
    await saveRule({ id: "R1", name: "Short sleep", trigger: "t", action: "a", evidence: "Smith 2020", keep: "keep" }, "scientist");
    const r = (await listRuleOverrides()).find((x) => x.id === "R1");
    expect(r?.evidence).toBe("Smith 2020");
    expect(r?.updated_by).toBe("scientist");
    await saveLabel({ id: "S01", decision: "none", edits: [], reason: "normal", rules_applied: [], labeled_at: new Date().toISOString() });
    expect((await listLabels()).find((l) => l.id === "S01")?.decision).toBe("none");
    const runId = await saveEvalRun({ at: new Date().toISOString(), model: "m", rules_hash: "abc", results: [], agreement: 80, do_nothing_agreement: 100, holdout_agreement: null, labeled: 1 });
    expect((await listEvalRuns(5)).some((x) => x.id === runId && x.agreement === 80)).toBe(true);
  });

  it("keeps one waitlist entry per email, ignoring case", async () => {
    expect(await saveLead("Coach@Example.com", "landing")).toBe(true);
    expect(await saveLead("coach@example.com", "landing")).toBe(false);
    const leads = await listLeads(10);
    expect(leads.filter((l) => l.email.toLowerCase() === "coach@example.com")).toHaveLength(1);
    expect(await countLeads()).toBeGreaterThanOrEqual(1);
  });
});
