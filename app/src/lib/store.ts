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

export type AthleteRow = { code: string; name: string; consented_at: string | null; protected: string[]; created_at: string };
export type SessionRow = { id: string; on_date: string; label: string; week_type: string; exercises: Exercise[] };
export type CheckinRow = { sleep_h: number; soreness: number; stress: number; note: string | null };
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
  name: d.name,
  consented_at: d.consented_at ?? null,
  protected: d.protected ?? [],
  created_at: d.created_at ?? "",
});
const proposal = (id: string, d: DocumentData): ProposalRow => ({ coach_note: null, edited_by_coach: false, ...d, id }) as ProposalRow;

// ---- pulse: a timestamp per audience that changes on every write, so open views can tell when to refresh.
export type PulseScope = "coach" | "science" | `a_${string}`;

export async function touch(...scopes: PulseScope[]): Promise<void> {
  const at = Date.now();
  await Promise.all(scopes.map((s) => fs.collection("pulse").doc(s).set({ at })));
}

export async function getPulse(scope: PulseScope): Promise<number> {
  const s = await fs.collection("pulse").doc(scope).get();
  return s.exists ? (s.get("at") as number) : 0;
}

// ---- activity feed
export async function logEvent(e: Omit<EventRow, "id" | "at">): Promise<void> {
  await fs.collection("events").add({ ...e, at: new Date().toISOString() });
}

export async function listEvents(limit: number): Promise<EventRow[]> {
  const q = await fs.collection("events").orderBy("at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as EventRow);
}

// ---- athletes
export async function createAthlete(name: string): Promise<string> {
  const code = randomBytes(5).toString("hex");
  await fs.collection("athletes").doc(code).set({ name, consented_at: null, protected: [], created_at: new Date().toISOString() });
  await logEvent({ type: "athlete_added", athlete_code: code, athlete_name: name, text: `${name} added` });
  await touch("coach");
  return code;
}

export async function getAthlete(code: string): Promise<AthleteRow | null> {
  if (!/^[0-9a-f]{10}$/.test(code)) return null;
  const s = await fs.collection("athletes").doc(code).get();
  return s.exists ? athlete(code, s.data()!) : null;
}

export async function listAthletes(): Promise<AthleteRow[]> {
  const q = await fs.collection("athletes").orderBy("created_at").get();
  return q.docs.map((d) => athlete(d.id, d.data()));
}

export async function giveConsentTo(code: string): Promise<void> {
  const ref = fs.collection("athletes").doc(code);
  let name: string | null = null;
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.exists && !s.get("consented_at")) {
      t.update(ref, { consented_at: new Date().toISOString() });
      name = s.get("name");
    }
  });
  if (name) {
    await logEvent({ type: "consent", athlete_code: code, athlete_name: name, text: `${name} agreed to the data terms` });
    await touch("coach", `a_${code}`);
  }
}

export async function setProtected(code: string, names: string[]): Promise<void> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 30);
  await fs.collection("athletes").doc(code).update({ protected: unique });
  await touch("coach", `a_${code}`);
}

// ---- program
export async function replaceSessions(sessions: Omit<SessionRow, "id">[]): Promise<void> {
  const old = await fs.collection("sessions").get();
  const batch = fs.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  sessions.forEach((s) => batch.set(fs.collection("sessions").doc(), s));
  await batch.commit();
  await logEvent({ type: "program", athlete_code: null, athlete_name: null, text: `Program imported: ${sessions.length} session${sessions.length === 1 ? "" : "s"}` });
  const athletes = await fs.collection("athletes").select().get();
  await touch("coach", ...athletes.docs.map((d) => `a_${d.id}` as PulseScope));
}

export async function countSessions(): Promise<number> {
  return (await fs.collection("sessions").count().get()).data().count;
}

export async function listSessions(fromDate: string, limit: number): Promise<SessionRow[]> {
  const q = await fs.collection("sessions").where("on_date", ">=", fromDate).orderBy("on_date").limit(limit).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

export async function sessionOn(date: string): Promise<SessionRow | null> {
  const q = await fs.collection("sessions").where("on_date", "==", date).limit(1).get();
  return q.empty ? null : session(q.docs[0].id, q.docs[0].data());
}

export async function sessionsOnDates(dates: string[]): Promise<SessionRow[]> {
  const q = await fs.collection("sessions").where("on_date", "in", dates).get();
  return q.docs.map((d) => session(d.id, d.data()));
}

export async function sessionBefore(date: string): Promise<{ on_date: string; label: string } | null> {
  const q = await fs.collection("sessions").where("on_date", "<", date).orderBy("on_date", "desc").limit(1).get();
  return q.empty ? null : { on_date: q.docs[0].get("on_date"), label: q.docs[0].get("label") };
}

// ---- athlete inputs
export async function saveCheckin(code: string, date: string, c: CheckinRow): Promise<void> {
  await fs.collection("checkins").doc(key(code, date)).set({ athlete_code: code, on_date: date, created_at: new Date().toISOString(), ...c });
  await touch("coach", `a_${code}`);
}

export async function getCheckins(code: string, dates: string[]): Promise<Map<string, CheckinRow>> {
  const snaps = await fs.getAll(...dates.map((d) => fs.collection("checkins").doc(key(code, d))));
  const out = new Map<string, CheckinRow>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], { sleep_h: s.get("sleep_h"), soreness: s.get("soreness"), stress: s.get("stress"), note: s.get("note") ?? null }));
  return out;
}

export async function getCheckin(code: string, date: string): Promise<(CheckinRow & { created_at: string | null }) | null> {
  const s = await fs.collection("checkins").doc(key(code, date)).get();
  if (!s.exists) return null;
  return { sleep_h: s.get("sleep_h"), soreness: s.get("soreness"), stress: s.get("stress"), note: s.get("note") ?? null, created_at: s.get("created_at") ?? null };
}

export async function hasCheckin(code: string, date: string): Promise<boolean> {
  return (await fs.collection("checkins").doc(key(code, date)).get()).exists;
}

const readinessRow = (s: DocumentData): ReadinessRow => ({
  sleep_h: s.sleep_h ?? null,
  hrv_ms: s.hrv_ms ?? null,
  resting_hr: s.resting_hr ?? null,
  provider: s.provider,
});

export async function saveReadiness(code: string, date: string, r: ReadinessRow): Promise<void> {
  await fs.collection("readiness").doc(key(code, date)).set({ athlete_code: code, on_date: date, ...r });
  await touch("coach", `a_${code}`);
}

export async function getReadiness(code: string, date: string): Promise<ReadinessRow | null> {
  const s = await fs.collection("readiness").doc(key(code, date)).get();
  return s.exists ? readinessRow(s.data()!) : null;
}

export async function getReadinessOn(code: string, dates: string[]): Promise<Map<string, ReadinessRow>> {
  const snaps = await fs.getAll(...dates.map((d) => fs.collection("readiness").doc(key(code, d))));
  const out = new Map<string, ReadinessRow>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], readinessRow(s.data()!)));
  return out;
}

export async function saveSessionLog(code: string, date: string, rpe: number): Promise<void> {
  await fs.collection("session_logs").doc(key(code, date)).set({ athlete_code: code, on_date: date, rpe });
  await touch("coach", `a_${code}`);
}

export async function getSessionLogs(code: string, dates: string[]): Promise<Map<string, number>> {
  const snaps = await fs.getAll(...dates.map((d) => fs.collection("session_logs").doc(key(code, d))));
  const out = new Map<string, number>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], s.get("rpe")));
  return out;
}

// ---- proposals
export async function getProposal(code: string, date: string): Promise<ProposalRow | null> {
  const s = await fs.collection("proposals").doc(key(code, date)).get();
  return s.exists ? proposal(s.id, s.data()!) : null;
}

export async function saveProposal(p: Omit<ProposalRow, "id" | "coach_note" | "edited_by_coach">): Promise<void> {
  await fs.collection("proposals").doc(key(p.athlete_code, p.on_date)).set({ ...p, coach_note: null, edited_by_coach: false });
  if (p.status === "pending") {
    await logEvent({ type: "proposal", athlete_code: p.athlete_code, athlete_name: p.athlete_name, text: `${p.athlete_name}: proposal to ${decisionCopy(p.decision).title.toLowerCase()}` });
  }
  await touch("coach", `a_${p.athlete_code}`);
}

export async function listProposals(limit: number): Promise<ProposalRow[]> {
  const q = await fs.collection("proposals").orderBy("created_at", "desc").limit(limit).get();
  return q.docs.map((d) => proposal(d.id, d.data()));
}

export async function listProposalsFor(code: string, limit: number): Promise<ProposalRow[]> {
  const q = await fs.collection("proposals").where("athlete_code", "==", code).get();
  return q.docs.map((d) => proposal(d.id, d.data())).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

export async function decideProposal(
  id: string,
  status: "approved" | "rejected",
  opts: { note?: string | null; edits?: Edit[] } = {},
): Promise<ProposalRow | null> {
  const ref = fs.collection("proposals").doc(id);
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
    await logEvent({ type: "decision", athlete_code: d.athlete_code, athlete_name: d.athlete_name, text: `Coach ${verb} for ${d.athlete_name}` });
    await touch("coach", `a_${d.athlete_code}`);
  }
  return d;
}

// ---- notices
export async function getNotice(k: string): Promise<string | null> {
  const s = await fs.collection("notices").doc(k).get();
  return s.exists ? s.get("v") : null;
}

export async function setNotice(k: string, v: string | null): Promise<void> {
  const ref = fs.collection("notices").doc(k);
  if (v === null) await ref.delete();
  else await ref.set({ v });
}

// ---- deletion
export async function deleteAthleteData(code: string): Promise<void> {
  const a = await getAthlete(code);
  for (const c of ["checkins", "readiness", "session_logs", "proposals", "events"]) {
    const q = await fs.collection(c).where("athlete_code", "==", code).get();
    for (let i = 0; i < q.docs.length; i += 400) {
      const batch = fs.batch();
      q.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await fs.collection("athletes").doc(code).delete();
  await fs.collection("polar_links").doc(code).delete();
  await fs.collection("pulse").doc(`a_${code}`).delete();
  if (a) await logEvent({ type: "athlete_removed", athlete_code: null, athlete_name: null, text: `${a.name} and all their data were removed` });
  await touch("coach");
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

export async function listRuleOverrides(): Promise<RuleRow[]> {
  const q = await fs.collection("rules").get();
  return q.docs.map((d) => ruleRow(d.id, d.data()));
}

export async function saveRule(r: Omit<RuleRow, "updated_at" | "updated_by">, by: string): Promise<void> {
  await fs.collection("rules").doc(r.id).set({ ...r, updated_at: new Date().toISOString(), updated_by: by });
  await logEvent({ type: "rule", athlete_code: null, athlete_name: null, text: `Rule ${r.id} saved (${r.keep ?? "unreviewed"})` });
  await touch("science", "coach");
}

export async function listLabels(): Promise<LabelRow[]> {
  const q = await fs.collection("labels").get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as LabelRow);
}

export async function saveLabel(l: LabelRow): Promise<void> {
  const { id, ...rest } = l;
  await fs.collection("labels").doc(id).set(rest);
  await touch("science");
}

export async function saveEvalRun(run: Omit<EvalRun, "id">): Promise<string> {
  const ref = await fs.collection("eval_runs").add(run);
  await touch("science");
  return ref.id;
}

export async function listEvalRuns(limit: number): Promise<EvalRun[]> {
  const q = await fs.collection("eval_runs").orderBy("at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as EvalRun);
}

// ---- waitlist
export type LeadRow = { id: string; email: string; club: string; source: string; created_at: string };

export async function saveLead(email: string, source: string, club = ""): Promise<boolean> {
  const id = createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 20);
  const ref = fs.collection("leads").doc(id);
  if ((await ref.get()).exists) return false;
  await ref.set({ email, club, source, created_at: new Date().toISOString() });
  await logEvent({ type: "lead", athlete_code: null, athlete_name: null, text: `New pilot request${club ? ` from ${club}` : ""}` });
  await touch("coach");
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
  await fs.collection("polar_links").doc(code).set(link);
  const a = await getAthlete(code);
  if (a) await logEvent({ type: "polar", athlete_code: code, athlete_name: a.name, text: `${a.name} connected Polar` });
  await touch("coach", `a_${code}`);
}

export async function getPolarLink(code: string): Promise<PolarLink | null> {
  const s = await fs.collection("polar_links").doc(code).get();
  return s.exists ? (s.data() as PolarLink) : null;
}

export async function patchPolarLink(code: string, patch: Partial<PolarLink>): Promise<void> {
  await fs.collection("polar_links").doc(code).update(patch);
  await touch("coach", `a_${code}`);
}

export async function deletePolarLink(code: string): Promise<void> {
  await fs.collection("polar_links").doc(code).delete();
  await touch("coach", `a_${code}`);
}
