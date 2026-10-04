import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { createHash, randomBytes } from "node:crypto";
import type { Edit, Exercise } from "./agent/schema";
import { cleanGroup, pickSession } from "./groups";
import { isActive, type Override } from "./overrides";
import type { ProgramDraft } from "./read/program";
import { decisionCopy } from "./copy";
import { CONSENT_VERSION } from "./consent";

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
  group: string | null; // the coach's group for this player; null means Everyone
  sample: boolean; // fictional player created by the sample squad, removable in one click
  consent_version: number; // 0 not agreed; see lib/consent.ts
  ask_always: boolean; // the coach wants every suggestion for this player to come to them, whatever is delegated
  created_at: string;
};
export type SessionRow = { id: string; on_date: string; label: string; week_type: string; exercises: Exercise[]; group: string | null; sample?: boolean };
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
  decided_by: "coach" | "delegated" | null; // delegated: the agent applied it under the coach's standing instruction
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
const session = (id: string, d: DocumentData): SessionRow => ({ id, on_date: d.on_date, label: d.label, week_type: d.week_type, exercises: d.exercises, group: cleanGroup(d.group) });
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
  group: cleanGroup(d.group),
  sample: d.sample === true,
  consent_version: typeof d.consent_version === "number" ? d.consent_version : d.consented_at ? 1 : 0,
  ask_always: d.ask_always === true,
  created_at: d.created_at ?? "",
});
const proposal = (id: string, d: DocumentData): ProposalRow => ({ coach_note: null, edited_by_coach: false, decided_by: null, ...d, id }) as ProposalRow;

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
export type ClubRow = { id: string; name: string; created_at: string; paid_at: string | null };
export type StaffRow = { id: string; email: string; name: string; club: string; roles: StaffRole[]; admin: boolean; pw: string; created_at: string; verified_at: string | null };
export type InviteRow = { token: string; kind: "staff" | "squad"; club: string; roles: StaffRole[]; expires_at: string | null; used_at: string | null; created_at: string };

const staffId = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 20);
const staffRow = (id: string, d: DocumentData): StaffRow => ({ id, email: d.email, name: d.name, club: d.club, roles: d.roles, admin: Boolean(d.admin), pw: d.pw, created_at: d.created_at, verified_at: d.verified_at ?? null });
const inviteRow = (token: string, d: DocumentData): InviteRow => ({ token, kind: d.kind, club: d.club, roles: d.roles ?? [], expires_at: d.expires_at ?? null, used_at: d.used_at ?? null, created_at: d.created_at });

export const STAFF_INVITE_DAYS = 7;

export async function listClubs(): Promise<ClubRow[]> {
  const q = await fs.collection("clubs").get();
  return q.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClubRow, "id">) }));
}

export async function getClub(id: string): Promise<ClubRow | null> {
  if (!/^[0-9a-f]{6}$/.test(id)) return null;
  const s = await fs.collection("clubs").doc(id).get();
  return s.exists ? { id, name: s.get("name"), created_at: s.get("created_at"), paid_at: s.get("paid_at") ?? null } : null;
}

export async function markClubPaid(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{6}$/.test(id)) return false;
  const ref = fs.collection("clubs").doc(id);
  if (!(await ref.get()).exists) return false;
  await ref.update({ paid_at: new Date().toISOString() });
  return true;
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
  return { club: { id, name: clubName, created_at: now, paid_at: null }, staff: staffRow(sid, data) };
}

export async function getStaff(id: string): Promise<StaffRow | null> {
  const s = await fs.collection("staff").doc(id).get();
  return s.exists ? staffRow(id, s.data()!) : null;
}

export async function getStaffByEmail(email: string): Promise<StaffRow | null> {
  return getStaff(staffId(email));
}

// ---- password reset. The emailed token is never stored: only its hash is, and it works once for an hour.
const RESET_MINUTES = 60;
const RESET_THROTTLE_MS = 60_000;
const resetId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createPasswordReset(email: string): Promise<{ token: string; staff: StaffRow } | "throttled" | null> {
  const staff = await getStaffByEmail(email);
  if (!staff) return null;
  const ref = fs.collection("staff").doc(staff.id);
  const last = (await ref.get()).get("reset_requested_at") as string | undefined;
  if (last && Date.now() - Date.parse(last) < RESET_THROTTLE_MS) return "throttled";
  const token = randomBytes(24).toString("hex");
  await fs.collection("resets").doc(resetId(token)).set({
    staff_id: staff.id, used_at: null, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + RESET_MINUTES * 60_000).toISOString(),
  });
  await ref.update({ reset_requested_at: new Date().toISOString() });
  return { token, staff };
}

// ---- sign-in attempt limits (see lib/login-guard.ts): one small document per hashed key
import type { Guard } from "./login-guard";
export async function getGuard(key: string): Promise<Guard | null> {
  const s = await fs.collection("login_guard").doc(createHash("sha256").update(key).digest("hex").slice(0, 32)).get();
  return s.exists ? (s.data() as Guard) : null;
}
export async function setGuard(key: string, g: Guard | null): Promise<void> {
  const ref = fs.collection("login_guard").doc(createHash("sha256").update(key).digest("hex").slice(0, 32));
  if (g === null) await ref.delete().catch(() => undefined);
  else await ref.set(g);
}

// ---- confirming an email address: a link sent to it, good for a day, worth nothing to anyone but its owner
const VERIFY_HOURS = 24;
export async function createEmailVerification(staffId: string): Promise<{ token: string; email: string } | "throttled" | "done" | null> {
  const ref = fs.collection("staff").doc(staffId);
  const st = await ref.get();
  if (!st.exists) return null;
  if (st.get("verified_at")) return "done";
  const last = st.get("verify_requested_at") as string | undefined;
  if (last && Date.now() - Date.parse(last) < RESET_THROTTLE_MS) return "throttled";
  const token = randomBytes(24).toString("hex");
  await fs.collection("verifications").doc(resetId(token)).set({ staff_id: staffId, email: st.get("email"), created_at: new Date().toISOString(), expires_at: new Date(Date.now() + VERIFY_HOURS * 3_600_000).toISOString() });
  await ref.update({ verify_requested_at: new Date().toISOString() });
  return { token, email: st.get("email") };
}

// Marks the address confirmed. Only if the account still has the address the link was sent to.
export async function verifyEmail(token: string): Promise<"ok" | "invalid"> {
  if (!/^[0-9a-f]{48}$/.test(token)) return "invalid";
  const ref = fs.collection("verifications").doc(resetId(token));
  const v = await ref.get();
  if (!v.exists || v.get("expires_at") <= new Date().toISOString()) return "invalid";
  const sRef = fs.collection("staff").doc(v.get("staff_id"));
  const st = await sRef.get();
  if (!st.exists || st.get("email") !== v.get("email")) return "invalid";
  if (!st.get("verified_at")) await sRef.update({ verified_at: new Date().toISOString() });
  await ref.delete();
  return "ok";
}

export async function resetTokenUsable(token: string): Promise<boolean> {
  if (!/^[0-9a-f]{48}$/.test(token)) return false;
  const s = await fs.collection("resets").doc(resetId(token)).get();
  return s.exists && !s.get("used_at") && s.get("expires_at") > new Date().toISOString();
}

// Sets the new password and spends the token in one transaction. Other open tokens for the same person are removed.
export async function resetPassword(token: string, pw: string): Promise<StaffRow | "invalid"> {
  if (!/^[0-9a-f]{48}$/.test(token)) return "invalid";
  const ref = fs.collection("resets").doc(resetId(token));
  let result: StaffRow | "invalid" = "invalid";
  let staffId_ = "";
  await fs.runTransaction(async (t) => {
    const r = await t.get(ref);
    if (!r.exists || r.get("used_at") || r.get("expires_at") <= new Date().toISOString()) return;
    const sRef = fs.collection("staff").doc(r.get("staff_id"));
    const st = await t.get(sRef);
    if (!st.exists) return;
    t.update(sRef, st.get("verified_at") ? { pw } : { pw, verified_at: new Date().toISOString() });
    t.update(ref, { used_at: new Date().toISOString() });
    staffId_ = sRef.id;
    result = staffRow(sRef.id, { ...st.data()!, pw });
  });
  if (staffId_) {
    const others = await fs.collection("resets").where("staff_id", "==", staffId_).get();
    await Promise.all(others.docs.filter((d) => d.id !== ref.id).map((d) => d.ref.delete()));
  }
  return result;
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
export type NewPlayerInput = { name: string; shirt: number | null; position: string; squad: string; group?: string | null; consented?: boolean };

export async function createPlayers(club: string, players: NewPlayerInput[], opts: { approved?: boolean; via?: "staff" | "link"; sample?: boolean } = {}): Promise<string[]> {
  const codes: string[] = [];
  const batch = fs.batch();
  const now = new Date().toISOString();
  players.forEach((p, i) => {
    const code = club + randomBytes(5).toString("hex");
    codes.push(code);
    batch.set(col(club, "athletes").doc(code), {
      name: p.name, shirt: p.shirt, position: p.position, squad: p.squad,
      approved: opts.approved ?? true, joined_via: opts.via ?? "staff",
      group: cleanGroup(p.group), sample: opts.sample === true,
      // Only sample players start already agreed; a real player always agrees themselves, on their own phone.
      consented_at: opts.sample && p.consented ? now : null, consent_version: opts.sample && p.consented ? CONSENT_VERSION : 0, device_token: null, claimed_at: null, protected: [],
      created_at: new Date(Date.parse(now) + i).toISOString(),
    });
  });
  await batch.commit();
  if (opts.sample) { await touch(club, "coach"); return codes; } // the sample loader writes its own activity line
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
  let updated = false;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists) return;
    if (!s.get("consented_at")) {
      t.update(ref, { consented_at: new Date().toISOString(), consent_version: CONSENT_VERSION });
      name = s.get("name");
    } else if ((s.get("consent_version") ?? 1) < CONSENT_VERSION) {
      t.update(ref, { consent_version: CONSENT_VERSION, consent_updated_at: new Date().toISOString() });
      name = s.get("name");
      updated = true;
    }
  });
  if (name) {
    await logEvent(club, { type: "consent", athlete_code: code, athlete_name: name, text: updated ? `${name} agreed to the updated data terms` : `${name} agreed to the data terms` });
    await touch(club, "coach", `a_${code}`);
  }
}

export async function setProtected(code: string, names: string[]): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 30);
  await col(clubOf(code), "athletes").doc(code).update({ protected: unique });
  await touch(clubOf(code), "coach", `a_${code}`);
}

// ---- fixtures
// Match dates the coach typed, and dates read from the club calendar, are one list to everything that uses them.
export async function getFixtures(club: string): Promise<string[]> {
  const d = (await fs.collection("clubs").doc(club).get()).data();
  return [...new Set([...((d?.fixtures as string[] | undefined) ?? []), ...((d?.calendar?.dates as string[] | undefined) ?? [])])].sort();
}

export async function getManualFixtures(club: string): Promise<string[]> {
  return ((await fs.collection("clubs").doc(club).get()).data()?.fixtures as string[] | undefined) ?? [];
}

export type CalendarLink = { url: string; synced_at: string | null; dates: string[]; examples: string[]; error: string | null };
export async function getCalendarLink(club: string): Promise<CalendarLink | null> {
  const c = (await fs.collection("clubs").doc(club).get()).data()?.calendar;
  return c ? { url: c.url, synced_at: c.synced_at ?? null, dates: c.dates ?? [], examples: c.examples ?? [], error: c.error ?? null } : null;
}
export async function saveCalendarLink(club: string, link: CalendarLink | null): Promise<void> {
  await fs.collection("clubs").doc(club).update({ calendar: link ?? FieldValue.delete() });
  await touch(club, "coach");
}
export async function listCalendarClubs(): Promise<string[]> {
  const q = await fs.collection("clubs").get();
  return q.docs.filter((d) => d.get("calendar")?.url).map((d) => d.id);
}

export async function setFixtures(club: string, dates: string[]): Promise<void> {
  await fs.collection("clubs").doc(club).update({ fixtures: dates });
  await touch(club, "coach");
}

// ---- program
// A date can hold several sessions: one for everyone (group null) and one per group that has its own version.
export async function replaceSessions(club: string, sessions: (Omit<SessionRow, "id" | "group"> & { group?: string | null })[]): Promise<void> {
  const old = await col(club, "sessions").get();
  const batch = fs.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  sessions.forEach((x) => batch.set(col(club, "sessions").doc(), { ...x, group: cleanGroup(x.group) }));
  await batch.commit();
  const own = sessions.filter((x) => cleanGroup(x.group)).length;
  await logEvent(club, { type: "program", athlete_code: null, athlete_name: null, text: `Program imported: ${sessions.length} session${sessions.length === 1 ? "" : "s"}${own ? `, ${own} for a group` : ""}` });
  const athletes = await col(club, "athletes").select().get();
  await touch(club, "coach", ...athletes.docs.map((d) => `a_${d.id}` as PulseScope));
}

export async function countSessions(club: string): Promise<number> {
  return (await col(club, "sessions").count().get()).data().count;
}

// Every session from a date on, group versions included, for the Program page.
export async function listSessions(club: string, fromDate: string, limit: number): Promise<SessionRow[]> {
  const q = await col(club, "sessions").where("on_date", ">=", fromDate).orderBy("on_date").limit(limit).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

// All versions on one date.
export async function sessionsOn(club: string, date: string): Promise<SessionRow[]> {
  const q = await col(club, "sessions").where("on_date", "==", date).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

// The session this player gets on a date: their group's version, else the one for everyone.
export async function sessionFor(club: string, date: string, group: string | null): Promise<SessionRow | null> {
  return pickSession(await sessionsOn(club, date), group);
}

// One session per date (the player's own version) for a run of dates.
export async function sessionsForDates(club: string, dates: string[], group: string | null): Promise<SessionRow[]> {
  const q = await col(club, "sessions").where("on_date", "in", dates).get();
  const byDate = new Map<string, SessionRow[]>();
  for (const d of q.docs) {
    const row = session(d.id, d.data());
    byDate.set(row.on_date, [...(byDate.get(row.on_date) ?? []), row]);
  }
  return [...byDate.values()].map((rows) => pickSession(rows, group)).filter((x): x is SessionRow => x !== null);
}

// The last session before a date that this player had (their own version when there is one).
export async function sessionBefore(club: string, date: string, group: string | null): Promise<{ on_date: string; label: string } | null> {
  const q = await col(club, "sessions").where("on_date", "<", date).orderBy("on_date", "desc").limit(40).get();
  const rows = q.docs.map((d) => session(d.id, d.data()));
  for (const day of [...new Set(rows.map((r) => r.on_date))]) {
    const mine = pickSession(rows.filter((r) => r.on_date === day), group);
    if (mine) return { on_date: mine.on_date, label: mine.label };
  }
  return null;
}

export async function setGroup(code: string, group: string | null): Promise<void> {
  await col(clubOf(code), "athletes").doc(code).update({ group: cleanGroup(group) });
  await touch(clubOf(code), "coach", `a_${code}`);
}

// ---- player overrides (the coach's own standing instruction for one player and one exercise)
const overrideRow = (id: string, d: DocumentData): Override => ({
  id, athlete_code: d.athlete_code, exercise: d.exercise, swap_to: d.swap_to ?? null, max_sets: d.max_sets ?? null, max_reps: d.max_reps ?? null,
  load_pct: d.load_pct ?? null, until: d.until ?? null, review_on: d.review_on ?? null, note: d.note ?? "", created_at: d.created_at, created_by: d.created_by ?? "",
  lifted_at: d.lifted_at ?? null,
});

// Newest first, including lifted ones, so the coach can see what was in force before.
export async function listOverrides(code: string): Promise<Override[]> {
  const q = await col(clubOf(code), "overrides").where("athlete_code", "==", code).get();
  return q.docs.map((d) => overrideRow(d.id, d.data())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
}

export async function listActiveOverrides(code: string, date: string): Promise<Override[]> {
  return (await listOverrides(code)).filter((o) => isActive(o, date));
}

// Every active override in the club, for the Today reminders.
export async function listClubOverrides(club: string, date: string): Promise<Override[]> {
  const q = await col(club, "overrides").where("lifted_at", "==", null).get();
  return q.docs.map((d) => overrideRow(d.id, d.data())).filter((o) => isActive(o, date));
}

export type NewOverride = Omit<Override, "id" | "athlete_code" | "created_at" | "lifted_at">;

// One active override per player and exercise: a new one lifts the one it replaces.
export async function createOverride(code: string, v: NewOverride): Promise<string> {
  const club = clubOf(code);
  const now = new Date().toISOString();
  const key = (n: string) => n.trim().toLowerCase();
  const batch = fs.batch();
  const same = (await listActiveOverrides(code, now.slice(0, 10))).filter((o) => key(o.exercise) === key(v.exercise));
  same.forEach((o) => batch.update(col(club, "overrides").doc(o.id), { lifted_at: now }));
  const ref = col(club, "overrides").doc();
  batch.set(ref, { athlete_code: code, ...v, created_at: now, lifted_at: null });
  await batch.commit();
  const a = await getAthlete(code);
  await logEvent(club, { type: "override", athlete_code: code, athlete_name: a?.name ?? null, text: `${v.created_by || "Coach"} set a plan change for ${a?.name ?? "a player"}: ${v.exercise}` });
  await touch(club, "coach", `a_${code}`);
  return ref.id;
}

export async function liftOverride(code: string, id: string, by: string): Promise<boolean> {
  const club = clubOf(code);
  const ref = col(club, "overrides").doc(id);
  const s = await ref.get();
  if (!s.exists || s.get("athlete_code") !== code || s.get("lifted_at")) return false;
  await ref.update({ lifted_at: new Date().toISOString() });
  const a = await getAthlete(code);
  await logEvent(club, { type: "override", athlete_code: code, athlete_name: a?.name ?? null, text: `${by || "Coach"} lifted the plan change for ${a?.name ?? "a player"}: ${s.get("exercise")}` });
  await touch(club, "coach", `a_${code}`);
  return true;
}

// ---- sample squad (fictional players, flagged so they can be removed in one step)
export async function listSampleAthletes(club: string): Promise<AthleteRow[]> {
  const q = await col(club, "athletes").where("sample", "==", true).get();
  return q.docs.map((d) => athlete(d.id, d.data()));
}

export async function deleteSampleSessions(club: string): Promise<number> {
  const q = await col(club, "sessions").where("sample", "==", true).get();
  const batch = fs.batch();
  q.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return q.size;
}

// ---- drafts: what the assistant read from the coach's own words, held until the coach confirms
// `origin` is where the coach started the draft, so the review can send them back there when it is done.
export type DraftRow = { id: string; status: "open" | "applied" | "discarded"; created_at: string; created_by: string; revisions: number; program: ProgramDraft; origin: "today" | null };
const DRAFT_ID = /^[A-Za-z0-9]{10,40}$/;

export async function createDraft(club: string, by: string, program: ProgramDraft, origin: "today" | null = null): Promise<string> {
  const ref = col(club, "drafts").doc();
  await ref.set({ kind: "program", status: "open", created_at: new Date().toISOString(), created_by: by, revisions: 0, program, origin });
  return ref.id;
}

export async function getDraft(club: string, id: string): Promise<DraftRow | null> {
  if (!DRAFT_ID.test(id)) return null;
  const s = await col(club, "drafts").doc(id).get();
  if (!s.exists) return null;
  const d = s.data()!;
  return { id, status: d.status, created_at: d.created_at, created_by: d.created_by ?? "", revisions: d.revisions ?? 0, program: d.program as ProgramDraft, origin: d.origin === "today" ? "today" : null };
}

export async function saveDraft(club: string, id: string, program: ProgramDraft, revisions: number): Promise<void> {
  await col(club, "drafts").doc(id).update({ program, revisions });
}

export async function closeDraft(club: string, id: string, status: "applied" | "discarded"): Promise<void> {
  await col(club, "drafts").doc(id).update({ status, closed_at: new Date().toISOString() });
}

// Puts the confirmed sessions in place of whatever the club had on those dates, and leaves every other date alone.
// Any sample sessions go too: a real program replaces them.
export async function replaceSessionsInRange(club: string, sessions: (Omit<SessionRow, "id" | "group"> & { group?: string | null })[], from: string, to: string): Promise<void> {
  const [inRange, sample] = await Promise.all([
    col(club, "sessions").where("on_date", ">=", from).where("on_date", "<=", to).get(),
    col(club, "sessions").where("sample", "==", true).get(),
  ]);
  const batch = fs.batch();
  new Map([...inRange.docs, ...sample.docs].map((d) => [d.id, d])).forEach((d) => batch.delete(d.ref));
  sessions.forEach((x) => batch.set(col(club, "sessions").doc(), { ...x, group: cleanGroup(x.group) }));
  await batch.commit();
  const own = sessions.filter((x) => cleanGroup(x.group)).length;
  await logEvent(club, { type: "program", athlete_code: null, athlete_name: null, text: `Program updated for ${from} to ${to}: ${sessions.length} session${sessions.length === 1 ? "" : "s"}${own ? `, ${own} for a group` : ""}` });
  const athletes = await col(club, "athletes").select().get();
  await touch(club, "coach", ...athletes.docs.map((d) => `a_${d.id}` as PulseScope));
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

export async function saveProposal(p: Omit<ProposalRow, "id" | "coach_note" | "edited_by_coach" | "decided_by">): Promise<void> {
  const club = clubOf(p.athlete_code);
  await col(club, "proposals").doc(key(p.athlete_code, p.on_date)).set({ ...p, coach_note: null, edited_by_coach: false, decided_by: null });
  if (p.status === "pending") {
    await logEvent(club, { type: "proposal", athlete_code: p.athlete_code, athlete_name: p.athlete_name, text: `${p.athlete_name}: proposal to ${decisionCopy(p.decision).title.toLowerCase()}` });
  }
  await touch(club, "coach", `a_${p.athlete_code}`);
}

// Check-ins from a date on, as the codes that answered, so the caller can leave out sample players.
export async function checkinCodesSince(club: string, from: string): Promise<string[]> {
  const q = await col(club, "checkins").where("on_date", ">=", from).limit(5000).get();
  return q.docs.map((d) => String(d.data().athlete_code));
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
  opts: { note?: string | null; edits?: Edit[]; by?: "coach" | "delegated" } = {},
): Promise<ProposalRow | null> {
  if (clubOf(id) !== club) return null;
  const ref = col(club, "proposals").doc(id);
  let decided: ProposalRow | null = null;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.get("status") !== "pending") return;
    const patch: Record<string, unknown> = { status, decided_at: new Date().toISOString(), coach_note: opts.note?.trim() || null, decided_by: opts.by ?? "coach" };
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
    await logEvent(club, { type: "decision", athlete_code: d.athlete_code, athlete_name: d.athlete_name, text: d.decided_by === "delegated" ? `Applied for ${d.athlete_name} under your standing instruction` : `Coach ${verb} for ${d.athlete_name}` });
    await touch(club, "coach", `a_${d.athlete_code}`);
  }
  return d;
}

// ---- rule thresholds (see lib/agent/thresholds.ts): the club's own numbers for four rules, with when they changed and any snooze
import { clamp, KEYS, readThresholds, type Thresholds, type TKey } from "./agent/thresholds";
export type Tuning = { thresholds: Thresholds; changed_at: Record<string, string>; snoozed_until: Record<string, string> };
export async function getTuning(club: string): Promise<Tuning> {
  const t = (await fs.collection("clubs").doc(club).get()).data()?.tuning;
  return { thresholds: readThresholds(t?.values), changed_at: t?.changed_at ?? {}, snoozed_until: t?.snoozed_until ?? {} };
}
export async function setThreshold(club: string, key: TKey, value: number | null, by: string): Promise<boolean> {
  if (!KEYS.includes(key)) return false;
  const cur = await getTuning(club);
  const next = value === null ? readThresholds({})[key] : clamp(key, value);
  const ref = fs.collection("clubs").doc(club);
  await ref.set({ tuning: { values: { ...cur.thresholds, [key]: next }, changed_at: { ...cur.changed_at, [key]: new Date().toISOString() }, snoozed_until: cur.snoozed_until } }, { merge: true });
  await logEvent(club, { type: "rule_tuning", athlete_code: null, athlete_name: null, text: `${by} set ${key.replace("_", " ")} to ${next}${value === null ? " (the default)" : ""}` });
  await touch(club, "coach", "science");
  return true;
}
export async function snoozeThreshold(club: string, key: TKey, until: string): Promise<void> {
  if (!KEYS.includes(key)) return;
  const cur = await getTuning(club);
  await fs.collection("clubs").doc(club).set({ tuning: { values: cur.thresholds, changed_at: cur.changed_at, snoozed_until: { ...cur.snoozed_until, [key]: until } } }, { merge: true });
  await touch(club, "coach");
}

// Takes back something the agent applied under a standing instruction: the player's plan stands again, and it does not count as a coach decision.
export async function undoDelegated(club: string, id: string): Promise<boolean> {
  if (clubOf(id) !== club) return false;
  const ref = col(club, "proposals").doc(id);
  let undone: ProposalRow | null = null;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (!s.exists || s.get("status") !== "approved" || s.get("decided_by") !== "delegated") return;
    t.update(ref, { status: "rejected", coach_note: "Taken back by the coach", decided_at: new Date().toISOString() });
    undone = proposal(id, s.data()!);
  });
  const u = undone as ProposalRow | null;
  if (u) {
    await logEvent(club, { type: "decision", athlete_code: u.athlete_code, athlete_name: u.athlete_name, text: `Coach took back the change for ${u.athlete_name}: the plan stands` });
    await touch(club, "coach", `a_${u.athlete_code}`);
  }
  return Boolean(u);
}

export async function getAutonomy(club: string): Promise<{ delegated: string[]; paused: boolean }> {
  const a = (await fs.collection("clubs").doc(club).get()).data()?.autonomy;
  return { delegated: Array.isArray(a?.delegated) ? a.delegated.filter((x: unknown) => typeof x === "string") : [], paused: a?.paused === true };
}
export async function setAutonomy(club: string, a: { delegated: string[]; paused: boolean }): Promise<void> {
  await fs.collection("clubs").doc(club).update({ autonomy: a });
  await touch(club, "coach");
}
export async function setAskAlways(code: string, on: boolean): Promise<void> {
  await col(clubOf(code), "athletes").doc(code).update({ ask_always: on });
  await touch(clubOf(code), "coach", `a_${code}`);
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

// ---- match minutes: what the coach tells us each player played, one record per player per date
export type MinutesEntry = { athlete_code: string; on_date: string; minutes: number };
export async function saveMinutes(club: string, onDate: string, rows: { code: string; name: string; minutes: number }[]): Promise<void> {
  const batch = fs.batch();
  for (const r of rows) batch.set(col(club, "minutes").doc(`${r.code}_${onDate}`), { athlete_code: r.code, on_date: onDate, minutes: r.minutes, created_at: new Date().toISOString() });
  await batch.commit();
  await logEvent(club, { type: "minutes", athlete_code: null, athlete_name: null, text: `Match minutes saved for ${rows.length} player${rows.length === 1 ? "" : "s"} (${onDate})` });
  await touch(club, "coach");
}
export async function listMinutesSince(club: string, from: string): Promise<MinutesEntry[]> {
  const q = await col(club, "minutes").where("on_date", ">=", from).limit(2000).get();
  return q.docs.map((d) => d.data() as MinutesEntry);
}
export async function hasMinutesOn(club: string, onDate: string): Promise<boolean> {
  return !(await col(club, "minutes").where("on_date", "==", onDate).limit(1).get()).empty;
}
export async function listMinutesFor(code: string, from: string): Promise<MinutesEntry[]> {
  const q = await col(clubOf(code), "minutes").where("athlete_code", "==", code).get();
  return q.docs.map((d) => d.data() as MinutesEntry).filter((m) => m.on_date >= from).sort((a, b) => b.on_date.localeCompare(a.on_date));
}

// ---- deletion
export async function deleteAthleteData(code: string, opts: { quiet?: boolean } = {}): Promise<void> {
  const club = clubOf(code);
  const a = await getAthlete(code);
  for (const c of ["checkins", "readiness", "session_logs", "proposals", "events", "overrides", "minutes"]) {
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
  if (a && !opts.quiet) await logEvent(club, { type: "athlete_removed", athlete_code: null, athlete_name: null, text: `${a.name} and all their data were removed` });
  await touch(club, "coach");
}

// Removes a whole club: every player and everything recorded about them, the program, staff accounts, invites and the club itself.
// The caller deregisters wearables first. Nothing is kept, and nothing can be undone.
export async function deleteClub(club: string): Promise<void> {
  if (!/^[0-9a-f]{6}$/.test(club)) return;
  const staff = await fs.collection("staff").where("club", "==", club).get();
  const ids = staff.docs.map((d) => d.id);
  for (const c of ["resets", "verifications"]) {
    for (let i = 0; i < ids.length; i += 30) {
      const q = await fs.collection(c).where("staff_id", "in", ids.slice(i, i + 30)).get();
      await Promise.all(q.docs.map((d) => d.ref.delete()));
    }
  }
  await Promise.all(staff.docs.map((d) => d.ref.delete()));
  const invites = await fs.collection("invites").where("club", "==", club).get();
  await Promise.all(invites.docs.map((d) => d.ref.delete()));
  await fs.recursiveDelete(fs.collection("clubs").doc(club));
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
