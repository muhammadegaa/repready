import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { createHash, randomBytes } from "node:crypto";
import type { Edit, Exercise } from "./agent/schema";
import { decisionCopy } from "./copy";

// Hosted (Vercel): FIREBASE_SERVICE_ACCOUNT holds the service-account JSON on one line.
// Local with the emulator: no credential is needed, only FIRESTORE_EMULATOR_HOST.
const account = process.env.FIREBASE_SERVICE_ACCOUNT;
const app =
  getApps()[0] ??
  initializeApp(account ? { credential: cert(JSON.parse(account)) } : { projectId: process.env.FIREBASE_PROJECT_ID ?? "repready-7dacd" });
const fs = getFirestore(app);

// Everything a club owns lives under clubs/{club}/. A player code is the 6-character club id plus 10 random characters,
// so any code-based call finds its club without a lookup.
export const CODE_RE = /^[0-9a-f]{16}$/;
export const clubOf = (code: string) => code.slice(0, 6);
const col = (club: string, name: string) => fs.collection("clubs").doc(club).collection(name);

export type AthleteRow = {
  code: string;
  club: string;
  approved: boolean;
  name: string;
  shirt: number | null;
  position: string;
  squad: string;
  consented_at: string | null;
  device_token: string | null;
  claimed_at: string | null;
  protected: string[];
  created_at: string;
};
export type SessionRow = { id: string; on_date: string; label: string; week_type: string; exercises: Exercise[] };
export type Availability = "full" | "limited" | "out";
export const AVAILABILITY: Availability[] = ["full", "limited", "out"];
export type CheckinRow = { sleep_h: number; soreness: number; stress: number; note: string | null; availability: Availability };
const availabilityOf = (v: unknown): Availability => (AVAILABILITY as unknown[]).includes(v) ? (v as Availability) : "full";
export type ReadinessRow = { sleep_h: number | null; hrv_ms: number | null; resting_hr: number | null; provider: string };
export type ProposalRow = {
  id: string;
  athlete_code: string;
  athlete_name: string;
  session_label: string;
  on_date: string;
  decision: string | null;
  edits: Edit[];
  reason: string | null;
  rules_applied: string[];
  flag: string | null;
  status: "pending" | "approved" | "rejected" | "no_change" | "error";
  error: string | null;
  created_at: string;
  decided_at: string | null;
  coach_note: string | null;
  edited_by_coach: boolean;
};
export type EventRow = { id: string; at: string; type: string; athlete_code: string | null; athlete_name: string | null; text: string };
export type RuleRow = { id: string; name: string; trigger: string; action: string; evidence: string; keep: "keep" | "change" | "delete" | null; updated_at: string | null; updated_by: string | null };
export type LabelRow = { id: string; decision: string; edits: Edit[]; reason: string; rules_applied: string[]; labeled_at: string };
export type EvalResult = { id: string; decision: string | null; edits: Edit[]; reason: string | null; error: string | null; expected: string | null; agree: boolean | null; holdout: boolean };
export type EvalRun = {
  id: string;
  at: string;
  model: string;
  rules_hash: string;
  results: EvalResult[];
  agreement: number | null;
  do_nothing_agreement: number | null;
  holdout_agreement: number | null;
  labeled: number;
};

const key = (code: string, date: string) => `${code}_${date}`;
const session = (id: string, d: DocumentData): SessionRow => ({ id, on_date: d.on_date, label: d.label, week_type: d.week_type, exercises: d.exercises });
const athlete = (code: string, d: DocumentData): AthleteRow => ({
  code,
  club: clubOf(code),
  approved: d.approved ?? true,
  name: d.name,
  shirt: d.shirt ?? null,
  position: d.position ?? "",
  squad: d.squad ?? "First team",
  consented_at: d.consented_at ?? null,
  device_token: d.device_token ?? null,
  claimed_at: d.claimed_at ?? null,
  protected: d.protected ?? [],
  created_at: d.created_at ?? "",
});
const proposal = (id: string, d: DocumentData): ProposalRow => ({ coach_note: null, edited_by_coach: false, ...d, id }) as ProposalRow;

// ---- pulse: a timestamp per audience that changes on every write, so open views can tell when to refresh.
export type PulseScope = "coach" | "science" | `a_${string}`;

export async function touch(club: string, ...scopes: PulseScope[]): Promise<void> {
  const at = Date.now();
  await Promise.all(scopes.map((s) => col(club, "pulse").doc(s).set({ at })));
}

export async function getPulse(club: string, scope: PulseScope): Promise<number> {
  const s = await col(club, "pulse").doc(scope).get();
  return s.exists ? (s.get("at") as number) : 0;
}

// ---- activity feed
export async function logEvent(club: string, e: Omit<EventRow, "id" | "at">): Promise<void> {
  await col(club, "events").add({ ...e, at: new Date().toISOString() });
}

export async function listEvents(club: string, limit: number): Promise<EventRow[]> {
  const q = await col(club, "events").orderBy("at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as EventRow);
}

// ---- clubs and staff
export type StaffRole = "coach" | "scientist";
export type ClubRow = { id: string; name: string; created_at: string };
export type StaffRow = { id: string; email: string; name: string; club: string; roles: StaffRole[]; admin: boolean; pw: string; created_at: string };
export type InviteRow = { token: string; kind: "staff" | "squad"; club: string; roles: StaffRole[]; expires_at: string | null; used_at: string | null; created_at: string };

const staffId = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 20);
const staffRow = (id: string, d: DocumentData): StaffRow => ({ id, email: d.email, name: d.name, club: d.club, roles: d.roles, admin: Boolean(d.admin), pw: d.pw, created_at: d.created_at });
const inviteRow = (token: string, d: DocumentData): InviteRow => ({ token, kind: d.kind, club: d.club, roles: d.roles ?? [], expires_at: d.expires_at ?? null, used_at: d.used_at ?? null, created_at: d.created_at });

export const STAFF_INVITE_DAYS = 7;

export async function getClub(id: string): Promise<ClubRow | null> {
  if (!/^[0-9a-f]{6}$/.test(id)) return null;
  const s = await fs.collection("clubs").doc(id).get();
  return s.exists ? { id, name: s.get("name"), created_at: s.get("created_at") } : null;
}

// Creates the club and its first staff member, who becomes the club admin with both views. Returns null when the email already has an account.
export async function createClubWithOwner(clubName: string, owner: { email: string; name: string; pw: string }): Promise<{ club: ClubRow; staff: StaffRow } | null> {
  const sid = staffId(owner.email);
  const now = new Date().toISOString();
  let id = randomBytes(3).toString("hex");
  while ((await fs.collection("clubs").doc(id).get()).exists) id = randomBytes(3).toString("hex");
  const staffRef = fs.collection("staff").doc(sid);
  const data = { email: owner.email.trim().toLowerCase(), name: owner.name, club: id, roles: ["coach", "scientist"] as StaffRole[], admin: true, pw: owner.pw, created_at: now };
  let ok = false;
  await fs.runTransaction(async (t) => {
    if ((await t.get(staffRef)).exists) return;
    t.set(staffRef, data);
    t.set(fs.collection("clubs").doc(id), { name: clubName, created_at: now });
    ok = true;
  });
  if (!ok) return null;
  await logEvent(id, { type: "club", athlete_code: null, athlete_name: null, text: `${clubName} created by ${owner.name}` });
  return { club: { id, name: clubName, created_at: now }, staff: staffRow(sid, data) };
}

export async function getStaff(id: string): Promise<StaffRow | null> {
  const s = await fs.collection("staff").doc(id).get();
  return s.exists ? staffRow(id, s.data()!) : null;
}

export async function getStaffByEmail(email: string): Promise<StaffRow | null> {
  return getStaff(staffId(email));
}

export async function listStaff(club: string): Promise<StaffRow[]> {
  const q = await fs.collection("staff").where("club", "==", club).get();
  return q.docs.map((d) => staffRow(d.id, d.data())).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function removeStaff(club: string, id: string): Promise<void> {
  const s = await getStaff(id);
  if (!s || s.club !== club || s.admin) return;
  await fs.collection("staff").doc(id).delete();
  await logEvent(club, { type: "staff_removed", athlete_code: null, athlete_name: null, text: `${s.name} was removed from the staff` });
  await touch(club, "coach");
}

export async function createStaffInvite(club: string, roles: StaffRole[]): Promise<string> {
  const token = randomBytes(16).toString("hex");
  const now = new Date();
  await fs.collection("invites").doc(token).set({
    kind: "staff", club, roles, used_at: null,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + STAFF_INVITE_DAYS * 86_400_000).toISOString(),
  });
  await touch(club, "coach");
  return token;
}

export async function listOpenStaffInvites(club: string): Promise<InviteRow[]> {
  const q = await fs.collection("invites").where("club", "==", club).get();
  const now = new Date().toISOString();
  return q.docs
    .map((d) => inviteRow(d.id, d.data()))
    .filter((i) => i.kind === "staff" && !i.used_at && (i.expires_at ?? "") > now)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function revokeInvite(club: string, token: string): Promise<void> {
  const ref = fs.collection("invites").doc(token);
  const s = await ref.get();
  if (s.exists && s.get("club") === club) await ref.delete();
  await touch(club, "coach");
}

export async function getInvite(token: string): Promise<InviteRow | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const s = await fs.collection("invites").doc(token).get();
  return s.exists ? inviteRow(token, s.data()!) : null;
}

export const inviteUsable = (i: InviteRow | null): i is InviteRow => Boolean(i) && !i!.used_at && (i!.expires_at === null || i!.expires_at > new Date().toISOString());

// Consumes a staff invite and creates the account in one transaction. "taken" means the email already has an account.
export async function acceptStaffInvite(token: string, who: { email: string; name: string; pw: string }): Promise<StaffRow | "invalid" | "taken"> {
  const inviteRef = fs.collection("invites").doc(token);
  const sid = staffId(who.email);
  const staffRef = fs.collection("staff").doc(sid);
  let result: StaffRow | "invalid" | "taken" = "invalid";
  await fs.runTransaction(async (t) => {
    const [inv, existing] = await Promise.all([t.get(inviteRef), t.get(staffRef)]);
    if (!inv.exists) return;
    const i = inviteRow(token, inv.data()!);
    if (i.kind !== "staff" || !inviteUsable(i)) return;
    if (existing.exists) { result = "taken"; return; }
    const data = { email: who.email.trim().toLowerCase(), name: who.name, club: i.club, roles: i.roles, admin: false, pw: who.pw, created_at: new Date().toISOString() };
    t.set(staffRef, data);
    t.update(inviteRef, { used_at: new Date().toISOString() });
    result = staffRow(sid, data);
  });
  const out = result as StaffRow | "invalid" | "taken";
  if (typeof out !== "string") {
    await logEvent(out.club, { type: "staff_joined", athlete_code: null, athlete_name: null, text: `${out.name} joined the staff as ${out.roles.join(" and ")}` });
    await touch(out.club, "coach");
  }
  return out;
}

// One reusable link per club that players use to join the squad. Rotating it kills the old one.
export async function squadInvite(club: string, rotate = false): Promise<string> {
  const ref = fs.collection("clubs").doc(club);
  const current = (await ref.get()).get("squad_invite") as string | undefined;
  if (current && !rotate) return current;
  if (current) await fs.collection("invites").doc(current).delete();
  const token = randomBytes(16).toString("hex");
  await fs.collection("invites").doc(token).set({ kind: "squad", club, roles: [], used_at: null, expires_at: null, created_at: new Date().toISOString() });
  await ref.update({ squad_invite: token });
  return token;
}

// ---- athletes
export type NewPlayerInput = { name: string; shirt: number | null; position: string; squad: string };

export async function createPlayers(club: string, players: NewPlayerInput[], opts: { approved?: boolean; via?: "staff" | "link" } = {}): Promise<string[]> {
  const codes: string[] = [];
  const batch = fs.batch();
  const now = new Date().toISOString();
  players.forEach((p, i) => {
    const code = club + randomBytes(5).toString("hex");
    codes.push(code);
    batch.set(col(club, "athletes").doc(code), {
      name: p.name, shirt: p.shirt, position: p.position, squad: p.squad,
      approved: opts.approved ?? true, joined_via: opts.via ?? "staff",
      consented_at: null, device_token: null, claimed_at: null, protected: [],
      created_at: new Date(Date.parse(now) + i).toISOString(),
    });
  });
  await batch.commit();
  const text = opts.via === "link"
    ? `${players[0].name} asked to join the squad`
    : players.length === 1 ? `${players[0].name} added to the squad` : `${players.length} players added to the squad`;
  await logEvent(club, { type: "athlete_added", athlete_code: null, athlete_name: null, text });
  await touch(club, "coach");
  return codes;
}

// The first phone to agree to the terms owns the link. Only an unclaimed link can be claimed.
export async function claimLink(code: string, token: string): Promise<boolean> {
  const club = clubOf(code);
  const ref = col(club, "athletes").doc(code);
  let claimed = false;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.exists && !s.get("device_token")) {
      t.update(ref, { device_token: token, claimed_at: new Date().toISOString() });
      claimed = true;
    }
  });
  if (claimed) await touch(club, "coach", `a_${code}`);
  return claimed;
}

// Coach reset: the old phone loses access and the next person to open the link can claim it.
export async function resetLink(code: string): Promise<void> {
  const club = clubOf(code);
  await col(club, "athletes").doc(code).update({ device_token: null, claimed_at: null });
  const a = await getAthlete(code);
  if (a) await logEvent(club, { type: "link_reset", athlete_code: code, athlete_name: a.name, text: `Link reset for ${a.name}` });
  await touch(club, "coach", `a_${code}`);
}

export async function getAthlete(code: string): Promise<AthleteRow | null> {
  if (!CODE_RE.test(code)) return null;
  const s = await col(clubOf(code), "athletes").doc(code).get();
  return s.exists ? athlete(code, s.data()!) : null;
}

export async function listAthletes(club: string): Promise<AthleteRow[]> {
  const q = await col(club, "athletes").orderBy("created_at").get();
  return q.docs.map((d) => athlete(d.id, d.data()));
}

export async function approvePlayer(code: string): Promise<void> {
  const club = clubOf(code);
  await col(club, "athletes").doc(code).update({ approved: true });
  const a = await getAthlete(code);
  if (a) await logEvent(club, { type: "athlete_approved", athlete_code: code, athlete_name: a.name, text: `${a.name} was confirmed as a squad member` });
  await touch(club, "coach", `a_${code}`);
}

export async function giveConsentTo(code: string): Promise<void> {
  const club = clubOf(code);
  const ref = col(club, "athletes").doc(code);
  let name: string | null = null;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.exists && !s.get("consented_at")) {
      t.update(ref, { consented_at: new Date().toISOString() });
      name = s.get("name");
    }
  });
  if (name) {
    await logEvent(club, { type: "consent", athlete_code: code, athlete_name: name, text: `${name} agreed to the data terms` });
    await touch(club, "coach", `a_${code}`);
  }
}

export async function setProtected(code: string, names: string[]): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 30);
  await col(clubOf(code), "athletes").doc(code).update({ protected: unique });
  await touch(clubOf(code), "coach", `a_${code}`);
}

// ---- fixtures
export async function getFixtures(club: string): Promise<string[]> {
  const s = await fs.collection("clubs").doc(club).get();
  return (s.data()?.fixtures as string[] | undefined) ?? [];
}

export async function setFixtures(club: string, dates: string[]): Promise<void> {
  await fs.collection("clubs").doc(club).update({ fixtures: dates });
  await touch(club, "coach");
}

// ---- program
export async function replaceSessions(club: string, sessions: Omit<SessionRow, "id">[]): Promise<void> {
  const old = await col(club, "sessions").get();
  const batch = fs.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  sessions.forEach((s) => batch.set(col(club, "sessions").doc(), s));
  await batch.commit();
  await logEvent(club, { type: "program", athlete_code: null, athlete_name: null, text: `Program imported: ${sessions.length} session${sessions.length === 1 ? "" : "s"}` });
  const athletes = await col(club, "athletes").select().get();
  await touch(club, "coach", ...athletes.docs.map((d) => `a_${d.id}` as PulseScope));
}

export async function countSessions(club: string): Promise<number> {
  return (await col(club, "sessions").count().get()).data().count;
}

export async function listSessions(club: string, fromDate: string, limit: number): Promise<SessionRow[]> {
  const q = await col(club, "sessions").where("on_date", ">=", fromDate).orderBy("on_date").limit(limit).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

export async function sessionOn(club: string, date: string): Promise<SessionRow | null> {
  const q = await col(club, "sessions").where("on_date", "==", date).limit(1).get();
  return q.empty ? null : session(q.docs[0].id, q.docs[0].data());
}

export async function sessionsOnDates(club: string, dates: string[]): Promise<SessionRow[]> {
  const q = await col(club, "sessions").where("on_date", "in", dates).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

export async function sessionBefore(club: string, date: string): Promise<{ on_date: string; label: string } | null> {
  const q = await col(club, "sessions").where("on_date", "<", date).orderBy("on_date", "desc").limit(1).get();
  return q.empty ? null : { on_date: q.docs[0].get("on_date"), label: q.docs[0].get("label") };
}

// ---- athlete inputs
export async function saveCheckin(code: string, date: string, c: Omit<CheckinRow, "availability"> & { availability?: Availability }): Promise<void> {
  const club = clubOf(code);
  await col(club, "checkins").doc(key(code, date)).set({ athlete_code: code, on_date: date, created_at: new Date().toISOString(), ...c, availability: c.availability ?? "full" });
  await touch(club, "coach", `a_${code}`);
}

export async function getCheckins(code: string, dates: string[]): Promise<Map<string, CheckinRow>> {
  const club = clubOf(code);
  const snaps = await fs.getAll(...dates.map((d) => col(club, "checkins").doc(key(code, d))));
  const out = new Map<string, CheckinRow>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], { sleep_h: s.get("sleep_h"), soreness: s.get("soreness"), stress: s.get("stress"), note: s.get("note") ?? null, availability: availabilityOf(s.get("availability")) }));
  return out;
}

export async function getCheckin(code: string, date: string): Promise<(CheckinRow & { created_at: string | null }) | null> {
  const s = await col(clubOf(code), "checkins").doc(key(code, date)).get();
  if (!s.exists) return null;
  return { sleep_h: s.get("sleep_h"), soreness: s.get("soreness"), stress: s.get("stress"), note: s.get("note") ?? null, availability: availabilityOf(s.get("availability")), created_at: s.get("created_at") ?? null };
}

export async function hasCheckin(code: string, date: string): Promise<boolean> {
  return (await col(clubOf(code), "checkins").doc(key(code, date)).get()).exists;
}

const readinessRow = (s: DocumentData): ReadinessRow => ({
  sleep_h: s.sleep_h ?? null,
  hrv_ms: s.hrv_ms ?? null,
  resting_hr: s.resting_hr ?? null,
  provider: s.provider,
});

export async function saveReadiness(code: string, date: string, r: ReadinessRow): Promise<void> {
  const club = clubOf(code);
  await col(club, "readiness").doc(key(code, date)).set({ athlete_code: code, on_date: date, ...r });
  await touch(club, "coach", `a_${code}`);
}

export async function getReadiness(code: string, date: string): Promise<ReadinessRow | null> {
  const s = await col(clubOf(code), "readiness").doc(key(code, date)).get();
  return s.exists ? readinessRow(s.data()!) : null;
}

export async function getReadinessOn(code: string, dates: string[]): Promise<Map<string, ReadinessRow>> {
  const club = clubOf(code);
  const snaps = await fs.getAll(...dates.map((d) => col(club, "readiness").doc(key(code, d))));
  const out = new Map<string, ReadinessRow>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], readinessRow(s.data()!)));
  return out;
}

export async function saveSessionLog(code: string, date: string, rpe: number): Promise<void> {
  const club = clubOf(code);
  await col(club, "session_logs").doc(key(code, date)).set({ athlete_code: code, on_date: date, rpe });
  await touch(club, "coach", `a_${code}`);
}

export async function getSessionLogs(code: string, dates: string[]): Promise<Map<string, number>> {
  const club = clubOf(code);
  const snaps = await fs.getAll(...dates.map((d) => col(club, "session_logs").doc(key(code, d))));
  const out = new Map<string, number>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], s.get("rpe")));
  return out;
}

// ---- proposals
export async function getProposal(code: string, date: string): Promise<ProposalRow | null> {
  const s = await col(clubOf(code), "proposals").doc(key(code, date)).get();
  return s.exists ? proposal(s.id, s.data()!) : null;
}

export async function saveProposal(p: Omit<ProposalRow, "id" | "coach_note" | "edited_by_coach">): Promise<void> {
  const club = clubOf(p.athlete_code);
  await col(club, "proposals").doc(key(p.athlete_code, p.on_date)).set({ ...p, coach_note: null, edited_by_coach: false });
  if (p.status === "pending") {
    await logEvent(club, { type: "proposal", athlete_code: p.athlete_code, athlete_name: p.athlete_name, text: `${p.athlete_name}: proposal to ${decisionCopy(p.decision).title.toLowerCase()}` });
  }
  await touch(club, "coach", `a_${p.athlete_code}`);
}

export async function listProposals(club: string, limit: number): Promise<ProposalRow[]> {
  const q = await col(club, "proposals").orderBy("created_at", "desc").limit(limit).get();
  return q.docs.map((d) => proposal(d.id, d.data()));
}

export async function listProposalsFor(code: string, limit: number): Promise<ProposalRow[]> {
  const q = await col(clubOf(code), "proposals").where("athlete_code", "==", code).get();
  return q.docs.map((d) => proposal(d.id, d.data())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

// The proposal id starts with the player code, so the club is the first 6 characters. A staff member can only decide their own club's proposals.
export async function decideProposal(
  club: string,
  id: string,
  status: "approved" | "rejected",
  opts: { note?: string | null; edits?: Edit[] } = {},
): Promise<ProposalRow | null> {
  if (clubOf(id) !== club) return null;
  const ref = col(club, "proposals").doc(id);
  let decided: ProposalRow | null = null;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.get("status") !== "pending") return;
    const patch: Record<string, unknown> = { status, decided_at: new Date().toISOString(), coach_note: opts.note?.trim() || null };
    if (opts.edits && status === "approved") {
      patch.edits = opts.edits;
      patch.edited_by_coach = true;
    }
    t.update(ref, patch);
    decided = proposal(id, { ...s.data()!, ...patch });
  });
  const d = decided as ProposalRow | null;
  if (d) {
    const verb = status === "approved" ? (d.edited_by_coach ? "approved with changes" : "approved") : "kept the plan";
    await logEvent(club, { type: "decision", athlete_code: d.athlete_code, athlete_name: d.athlete_name, text: `Coach ${verb} for ${d.athlete_name}` });
    await touch(club, "coach", `a_${d.athlete_code}`);
  }
  return d;
}

// ---- notices
export async function getNotice(club: string, k: string): Promise<string | null> {
  const s = await col(club, "notices").doc(k).get();
  return s.exists ? s.get("v") : null;
}

export async function setNotice(club: string, k: string, v: string | null): Promise<void> {
  const ref = col(club, "notices").doc(k);
  if (v === null) await ref.delete();
  else await ref.set({ v });
}

// ---- deletion
export async function deleteAthleteData(code: string): Promise<void> {
  const club = clubOf(code);
  const a = await getAthlete(code);
  for (const c of ["checkins", "readiness", "session_logs", "proposals", "events"]) {
    const q = await col(club, c).where("athlete_code", "==", code).get();
    for (let i = 0; i < q.docs.length; i += 400) {
      const batch = fs.batch();
      q.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await col(club, "athletes").doc(code).delete();
  await col(club, "polar_links").doc(code).delete();
  await col(club, "pulse").doc(`a_${code}`).delete();
  if (a) await logEvent(club, { type: "athlete_removed", athlete_code: null, athlete_name: null, text: `${a.name} and all their data were removed` });
  await touch(club, "coach");
}

// ---- science: rules, labels, evaluation runs
const ruleRow = (id: string, d: DocumentData): RuleRow => ({
  id,
  name: d.name,
  trigger: d.trigger,
  action: d.action,
  evidence: d.evidence ?? "",
  keep: d.keep ?? null,
  updated_at: d.updated_at ?? null,
  updated_by: d.updated_by ?? null,
});

export async function listRuleOverrides(club: string): Promise<RuleRow[]> {
  const q = await col(club, "rules").get();
  return q.docs.map((d) => ruleRow(d.id, d.data()));
}

export async function saveRule(club: string, r: Omit<RuleRow, "updated_at" | "updated_by">, by: string): Promise<void> {
  await col(club, "rules").doc(r.id).set({ ...r, updated_at: new Date().toISOString(), updated_by: by });
  await logEvent(club, { type: "rule", athlete_code: null, athlete_name: null, text: `Rule ${r.id} saved (${r.keep ?? "unreviewed"})` });
  await touch(club, "science", "coach");
}

export async function listLabels(club: string): Promise<LabelRow[]> {
  const q = await col(club, "labels").get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as LabelRow);
}

export async function saveLabel(club: string, l: LabelRow): Promise<void> {
  const { id, ...rest } = l;
  await col(club, "labels").doc(id).set(rest);
  await touch(club, "science");
}

export async function saveEvalRun(club: string, run: Omit<EvalRun, "id">): Promise<string> {
  const ref = await col(club, "eval_runs").add(run);
  await touch(club, "science");
  return ref.id;
}

export async function listEvalRuns(club: string, limit: number): Promise<EvalRun[]> {
  const q = await col(club, "eval_runs").orderBy("at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as EvalRun);
}

// ---- pilot requests (RepReady's own list, not a club's)
export type LeadRow = { id: string; email: string; club: string; source: string; created_at: string };

export async function saveLead(email: string, source: string, club = ""): Promise<boolean> {
  const id = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 20);
  const ref = fs.collection("leads").doc(id);
  if ((await ref.get()).exists) return false;
  await ref.set({ email, club, source, created_at: new Date().toISOString() });
  return true;
}

export async function listLeads(limit: number): Promise<LeadRow[]> {
  const q = await fs.collection("leads").orderBy("created_at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as LeadRow);
}

export async function countLeads(): Promise<number> {
  return (await fs.collection("leads").count().get()).data().count;
}

// ---- Polar connection (one per athlete)
export type PolarLink = { access_token: string; polar_user_id: number | null; connected_at: string; last_synced_at: string | null; error: string | null };

export async function savePolarLink(code: string, link: PolarLink): Promise<void> {
  const club = clubOf(code);
  await col(club, "polar_links").doc(code).set(link);
  const a = await getAthlete(code);
  if (a) await logEvent(club, { type: "polar", athlete_code: code, athlete_name: a.name, text: `${a.name} connected Polar` });
  await touch(club, "coach", `a_${code}`);
}

export async function getPolarLink(code: string): Promise<PolarLink | null> {
  const s = await col(clubOf(code), "polar_links").doc(code).get();
  return s.exists ? (s.data() as PolarLink) : null;
}

export async function patchPolarLink(code: string, patch: Partial<PolarLink>): Promise<void> {
  await col(clubOf(code), "polar_links").doc(code).update(patch);
  await touch(clubOf(code), "coach", `a_${code}`);
}

export async function deletePolarLink(code: string): Promise<void> {
  await col(clubOf(code), "polar_links").doc(code).delete();
  await touch(clubOf(code), "coach", `a_${code}`);
}
