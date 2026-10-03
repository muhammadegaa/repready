import { describe, expect, it } from "vitest";
import {
  acceptStaffInvite, approvePlayer, clubOf, countSessions, createClubWithOwner, createStaffInvite, decideProposal, deleteAthleteData, getAthlete, getCheckin, getCheckins, getNotice, getProposal, getPulse, getSessionLogs,
  giveConsentTo, hasCheckin, listAthletes, listEvalRuns, listEvents, listLabels, listProposals, listProposalsFor, listRuleOverrides, listSessions,
  logEvent, replaceSessions, saveCheckin, saveEvalRun, saveLabel, saveProposal, saveRule, saveSessionLog, sessionBefore, sessionFor, sessionsOn, setGroup,
  sessionsForDates, setNotice, setProtected, touch, saveLead, listLeads, countLeads, createPlayers, claimLink, resetLink,
  createPasswordReset, resetPassword, resetTokenUsable,
  getInvite, getStaffByEmail, inviteUsable, listStaff, removeStaff, squadInvite, 
} from "./store";

// Needs the Firestore emulator: npm run test:emulator
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)("store (Firestore emulator)", () => {
  const run = Date.now().toString(36);
  const C = "abc123";
  const other = "def456";
  const createAthlete = async (name: string, club = C) => (await createPlayers(club, [{ name, shirt: null, position: "", squad: "First team" }]))[0];
  const ex = [{ name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 }];

  it("creates an athlete, rejects odd codes, records consent once", async () => {
    const code = await createAthlete("Test Athlete");
    expect(code).toMatch(/^abc123[0-9a-f]{10}$/);
    expect((await getAthlete(code))?.consented_at).toBeNull();
    expect(await getAthlete("not-a-code")).toBeNull();
    expect(await getAthlete("0000000000")).toBeNull();
    await giveConsentTo(code);
    const first = (await getAthlete(code))?.consented_at;
    expect(first).toBeTruthy();
    await giveConsentTo(code);
    expect((await getAthlete(code))?.consented_at).toBe(first);
    expect((await listAthletes(C)).some((a) => a.code === code)).toBe(true);
  });

  it("replaces sessions and finds them by date", async () => {
    await replaceSessions(C, [
      { on_date: "2030-01-01", label: "A", week_type: "normal", exercises: ex },
      { on_date: "2030-01-03", label: "B", week_type: "deload", exercises: ex },
    ]);
    expect(await countSessions(C)).toBe(2);
    expect((await sessionFor(C, "2030-01-03", null))?.week_type).toBe("deload");
    expect(await sessionFor(C, "2030-01-02", null)).toBeNull();
    expect((await sessionBefore(C, "2030-01-03", null))?.label).toBe("A");
    expect(await sessionBefore(C, "2030-01-01", null)).toBeNull();
    expect((await sessionsForDates(C, ["2030-01-01", "2030-01-02", "2030-01-03"], null)).length).toBe(2);
    await replaceSessions(C, [{ on_date: "2030-02-01", label: "C", week_type: "normal", exercises: ex }]);
    expect(await countSessions(C)).toBe(1);
  });

  it("stores check-ins and session logs by day", async () => {
    const code = await createAthlete("Logger");
    await saveCheckin(code, "2030-03-01", { sleep_h: 6.5, soreness: 4, stress: 3, note: null });
    expect(await hasCheckin(code, "2030-03-01")).toBe(true);
    expect(await hasCheckin(code, "2030-03-02")).toBe(false);
    const c = await getCheckins(code, ["2030-03-01", "2030-03-02"]);
    expect(c.get("2030-03-01")?.sleep_h).toBe(6.5);
    expect(c.has("2030-03-02")).toBe(false);
    expect(c.get("2030-03-01")?.availability).toBe("full"); // older check-ins and ones that skip the item read as available
    await saveCheckin(code, "2030-03-02", { sleep_h: 7, soreness: 1, stress: 1, note: null, availability: "limited" });
    expect((await getCheckins(code, ["2030-03-02"])).get("2030-03-02")?.availability).toBe("limited");
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
    await decideProposal(C, id, "approved");
    expect((await getProposal(code, "2030-04-01"))?.status).toBe("approved");
    await decideProposal(C, id, "rejected");
    expect((await getProposal(code, "2030-04-01"))?.status).toBe("approved");
    expect((await listProposals(C, 10)).some((p) => p.id === id)).toBe(true);
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
    await setNotice(C, "import", "Row 2: bad");
    expect(await getNotice(C, "import")).toBe("Row 2: bad");
    await setNotice(C, "import", null);
    expect(await getNotice(C, "import")).toBeNull();
  });

  it("moves the pulse on every write so open views know to refresh", async () => {
    const before = await getPulse(C, "coach");
    await new Promise((r) => setTimeout(r, 5));
    const code = await createAthlete("Pulse");
    const afterAdd = await getPulse(C, "coach");
    expect(afterAdd).toBeGreaterThan(before);
    await new Promise((r) => setTimeout(r, 5));
    await saveCheckin(code, "2030-06-01", { sleep_h: 7, soreness: 1, stress: 1, note: null });
    expect(await getPulse(C, `a_${code}`)).toBeGreaterThan(0);
    expect(await getPulse(C, "coach")).toBeGreaterThan(afterAdd);
    await touch(C, "science");
    expect(await getPulse(C, "science")).toBeGreaterThan(0);
    expect(await getPulse(C, "a_0000000001")).toBe(0);
  });

  it("keeps an activity feed, newest first", async () => {
    await logEvent(C, { type: "t", athlete_code: null, athlete_name: null, text: "first" });
    await new Promise((r) => setTimeout(r, 5));
    await logEvent(C, { type: "t", athlete_code: null, athlete_name: null, text: "second" });
    const ev = await listEvents(C, 50);
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
    const d = await decideProposal(C, id, "approved", { note: " go easy ", edits: [{ kind: "set_sets", exercise: "Back squat", to: 2 }] });
    expect(d?.edited_by_coach).toBe(true);
    const p = await getProposal(code, "2030-07-01");
    expect(p?.coach_note).toBe("go easy");
    expect(p?.edits).toEqual([{ kind: "set_sets", exercise: "Back squat", to: 2 }]);
    expect(await decideProposal(C, id, "rejected")).toBeNull();
    expect((await listProposalsFor(code, 5)).length).toBe(1);
    expect((await listEvents(C, 50)).some((e) => e.text.includes("approved with changes for Decide"))).toBe(true);
  });

  it("lists upcoming sessions in date order", async () => {
    await replaceSessions(C, [
      { on_date: "2031-01-03", label: "C", week_type: "normal", exercises: ex },
      { on_date: "2031-01-01", label: "A", week_type: "normal", exercises: ex },
      { on_date: "2030-12-30", label: "Past", week_type: "normal", exercises: ex },
    ]);
    expect((await listSessions(C, "2031-01-01", 10)).map((x) => x.label)).toEqual(["A", "C"]);
  });

  it("saves rules, labels and evaluation runs", async () => {
    await saveRule(C, { id: "R1", name: "Short sleep", trigger: "t", action: "a", evidence: "Smith 2020", keep: "keep" }, "scientist");
    const r = (await listRuleOverrides(C)).find((x) => x.id === "R1");
    expect(r?.evidence).toBe("Smith 2020");
    expect(r?.updated_by).toBe("scientist");
    await saveLabel(C, { id: "S01", decision: "none", edits: [], reason: "normal", rules_applied: [], labeled_at: new Date().toISOString() });
    expect((await listLabels(C)).find((l) => l.id === "S01")?.decision).toBe("none");
    const runId = await saveEvalRun(C, { at: new Date().toISOString(), model: "m", rules_hash: "abc", results: [], agreement: 80, do_nothing_agreement: 100, holdout_agreement: null, labeled: 1 });
    expect((await listEvalRuns(C, 5)).some((x) => x.id === runId && x.agreement === 80)).toBe(true);
  });

  it("keeps one waitlist entry per email, ignoring case", async () => {
    const email = `coach-${run}@example.com`; // unique per run, so the test can be repeated against the same emulator
    expect(await saveLead(email.replace("coach", "Coach"), "landing", "Example FC")).toBe(true);
    expect(await saveLead(email, "landing")).toBe(false);
    const leads = await listLeads(500);
    expect(leads.filter((l) => l.email.toLowerCase() === email)).toHaveLength(1);
    expect(leads.find((l) => l.email.toLowerCase() === email)?.club).toBe("Example FC");
    expect(await countLeads()).toBeGreaterThanOrEqual(1);
  });

  it("creates players with shirt, position and squad, and lets one phone claim a link until the coach resets it", async () => {
    const [a, b] = await createPlayers(C, [
      { name: "J. Mensah", shirt: 5, position: "Centre-back", squad: "First team" },
      { name: "L. Ortiz", shirt: null, position: "", squad: "U21" },
    ]);
    const p = await getAthlete(a);
    expect([p?.shirt, p?.position, p?.squad, p?.device_token]).toEqual([5, "Centre-back", "First team", null]);
    expect((await getAthlete(b))?.squad).toBe("U21");
    expect(await claimLink(a, "token-one")).toBe(true);
    expect(await claimLink(a, "token-two")).toBe(false); // already owned
    expect((await getAthlete(a))?.device_token).toBe("token-one");
    await resetLink(a);
    expect((await getAthlete(a))?.device_token).toBeNull();
    expect(await claimLink(a, "token-two")).toBe(true);
  });

  it("keeps each club's data apart", async () => {
    const mine = await createAthlete("Mine");
    const theirs = await createAthlete("Theirs", other);
    expect(clubOf(mine)).toBe(C);
    expect(clubOf(theirs)).toBe(other);
    expect((await listAthletes(C)).some((a) => a.code === theirs)).toBe(false);
    expect((await listAthletes(other)).some((a) => a.code === mine)).toBe(false);
    await replaceSessions(other, [{ on_date: "2032-01-01", label: "Theirs", week_type: "normal", exercises: ex }]);
    expect(await sessionFor(C, "2032-01-01", null)).toBeNull();
    expect((await sessionFor(other, "2032-01-01", null))?.label).toBe("Theirs");
    await saveProposal({
      athlete_code: theirs, athlete_name: "Theirs", session_label: "A", on_date: "2032-01-01", decision: "reduce", edits: [], reason: "r", rules_applied: [],
      flag: null, status: "pending", error: null, created_at: new Date().toISOString(), decided_at: null,
    });
    expect(await decideProposal(C, `${theirs}_2032-01-01`, "approved")).toBeNull(); // another club's staff cannot decide it
    expect((await getProposal(theirs, "2032-01-01"))?.status).toBe("pending");
  });

  it("holds self-joined players until staff confirm them", async () => {
    const [code] = await createPlayers(C, [{ name: "Self", shirt: 7, position: "Winger", squad: "First team" }], { approved: false, via: "link" });
    expect((await getAthlete(code))?.approved).toBe(false);
    await approvePlayer(code);
    expect((await getAthlete(code))?.approved).toBe(true);
    expect((await createAthlete("Staff added", C)).length).toBe(16);
    expect((await listAthletes(C)).find((a) => a.name === "Staff added")?.approved).toBe(true);
  });

  it("creates a club with an admin, then lets an invite create staff exactly once", async () => {
    const email = `admin-${Date.now()}@club.test`;
    const made = await createClubWithOwner("Test FC", { email, name: "Ada", pw: "salt:hash" });
    expect(made?.staff.admin).toBe(true);
    expect(made?.staff.roles).toEqual(["coach", "scientist"]);
    expect(await createClubWithOwner("Other FC", { email: email.toUpperCase(), name: "Dup", pw: "x" })).toBeNull();
    const club = made!.club.id;
    expect((await getStaffByEmail(email))?.club).toBe(club);

    const token = await createStaffInvite(club, ["scientist"]);
    expect(inviteUsable(await getInvite(token))).toBe(true);
    const joined = await acceptStaffInvite(token, { email: `sci-${Date.now()}@club.test`, name: "Sam", pw: "p" });
    expect(typeof joined).toBe("object");
    if (typeof joined === "object") expect([joined.club, joined.roles, joined.admin]).toEqual([club, ["scientist"], false]);
    expect(await acceptStaffInvite(token, { email: `again-${Date.now()}@club.test`, name: "Late", pw: "p" })).toBe("invalid");
    expect(await acceptStaffInvite(await createStaffInvite(club, ["coach"]), { email, name: "Dup", pw: "p" })).toBe("taken");
    expect((await listStaff(club)).map((x) => x.name)).toEqual(["Ada", "Sam"]);
    if (typeof joined === "object") {
      await removeStaff(other, joined.id); // wrong club: no effect
      expect(await listStaff(club)).toHaveLength(2);
      await removeStaff(club, joined.id);
      expect(await listStaff(club)).toHaveLength(1);
    }
  });

  it("keeps one reusable squad link per club and replaces it on request", async () => {
    const made = await createClubWithOwner("Link FC", { email: `link-${Date.now()}@club.test`, name: "L", pw: "p" });
    const club = made!.club.id;
    const first = await squadInvite(club);
    expect(await squadInvite(club)).toBe(first);
    expect((await getInvite(first))?.kind).toBe("squad");
    const next = await squadInvite(club, true);
    expect(next).not.toBe(first);
    expect(await getInvite(first)).toBeNull();
    expect(inviteUsable(await getInvite(next))).toBe(true);
  });

  it("resets a password once, with a throttle, and never for unknown emails", async () => {
    const email = `reset-${run}@test.example`;
    const made = await createClubWithOwner("Reset FC", { email, name: "R", pw: "old-hash" });
    expect(made).not.toBeNull();
    expect(await createPasswordReset(`nobody-${run}@test.example`)).toBeNull();
    const r = await createPasswordReset(email);
    expect(r).toMatchObject({ token: expect.stringMatching(/^[0-9a-f]{48}$/) });
    expect(await createPasswordReset(email)).toBe("throttled");
    const token = (r as { token: string }).token;
    expect(await resetTokenUsable(token)).toBe(true);
    expect(await resetTokenUsable("0".repeat(48))).toBe(false);
    const done = await resetPassword(token, "new-hash");
    expect(done).toMatchObject({ pw: "new-hash" });
    expect((await getStaffByEmail(email))?.pw).toBe("new-hash");
    expect(await resetTokenUsable(token)).toBe(false);
    expect(await resetPassword(token, "again")).toBe("invalid");
    expect((await getStaffByEmail(email))?.pw).toBe("new-hash");
  });

  it("gives each player their group's version of a session, and the base to everyone else", async () => {
    const club = `g${run}`.slice(0, 6).padEnd(6, "0");
    const base = [{ name: "Back squat", sets: 4, reps: 5, load: "85%", target_rpe: 8 }];
    const reserves = [{ name: "Back squat", sets: 5, reps: 5, load: "85%", target_rpe: 8 }, { name: "Nordic hamstring curl", sets: 3, reps: 5, load: "BW", target_rpe: 8 }];
    await replaceSessions(club, [
      { on_date: "2034-03-01", label: "Lower", week_type: "normal", exercises: base },
      { on_date: "2034-03-01", label: "Lower", week_type: "normal", exercises: reserves, group: "Reserves" },
      { on_date: "2034-03-03", label: "Upper", week_type: "normal", exercises: base },
      { on_date: "2034-03-05", label: "Reserves only", week_type: "normal", exercises: reserves, group: "Reserves" },
    ]);
    expect((await sessionsOn(club, "2034-03-01")).map((x) => x.group ?? "").sort()).toEqual(["", "Reserves"]);
    expect((await sessionFor(club, "2034-03-01", "Reserves"))?.exercises).toHaveLength(2);
    expect((await sessionFor(club, "2034-03-01", "reserves"))?.exercises).toHaveLength(2); // case does not matter
    expect((await sessionFor(club, "2034-03-01", "Starters"))?.exercises).toHaveLength(1);
    expect((await sessionFor(club, "2034-03-01", null))?.exercises).toHaveLength(1);
    // a day only one group has
    expect(await sessionFor(club, "2034-03-05", null)).toBeNull();
    expect((await sessionFor(club, "2034-03-05", "Reserves"))?.label).toBe("Reserves only");
    // one session per date for a run of dates
    expect((await sessionsForDates(club, ["2034-03-01", "2034-03-03", "2034-03-05"], "Reserves")).map((x) => x.on_date)).toEqual(expect.arrayContaining(["2034-03-01", "2034-03-03", "2034-03-05"]));
    expect((await sessionsForDates(club, ["2034-03-01", "2034-03-03", "2034-03-05"], null)).map((x) => x.on_date).sort()).toEqual(["2034-03-01", "2034-03-03"]);
    expect((await sessionBefore(club, "2034-03-06", null))?.label).toBe("Upper"); // skips the day only Reserves train
    expect((await sessionBefore(club, "2034-03-06", "Reserves"))?.label).toBe("Reserves only");
  });

  it("stores a player's group, cleans it, and treats Everyone as none", async () => {
    const code = await createAthlete("Grouped");
    expect((await getAthlete(code))?.group).toBeNull();
    await setGroup(code, "  Reserves ");
    expect((await getAthlete(code))?.group).toBe("Reserves");
    await setGroup(code, "Everyone");
    expect((await getAthlete(code))?.group).toBeNull();
  });
});
