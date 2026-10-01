import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type DocumentData } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";
import type { Edit, Exercise } from "./agent/schema";

const app = getApps()[0] ?? initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? "repready-7dacd" });
const fs = getFirestore(app);

export type AthleteRow = { code: string; name: string; consented_at: string | null };
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
};

const key = (code: string, date: string) => `${code}_${date}`;
const session = (id: string, d: DocumentData): SessionRow => ({ id, on_date: d.on_date, label: d.label, week_type: d.week_type, exercises: d.exercises });

export async function createAthlete(name: string): Promise<string> {
  const code = randomBytes(5).toString("hex");
  await fs.collection("athletes").doc(code).set({ name, consented_at: null, created_at: new Date().toISOString() });
  return code;
}

export async function getAthlete(code: string): Promise<AthleteRow | null> {
  if (!/^[0-9a-f]{10}$/.test(code)) return null;
  const s = await fs.collection("athletes").doc(code).get();
  return s.exists ? { code, name: s.get("name"), consented_at: s.get("consented_at") ?? null } : null;
}

export async function listAthletes(): Promise<AthleteRow[]> {
  const q = await fs.collection("athletes").orderBy("created_at").get();
  return q.docs.map((d) => ({ code: d.id, name: d.get("name"), consented_at: d.get("consented_at") ?? null }));
}

export async function giveConsentTo(code: string): Promise<void> {
  const ref = fs.collection("athletes").doc(code);
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.exists && !s.get("consented_at")) t.update(ref, { consented_at: new Date().toISOString() });
  });
}

export async function replaceSessions(sessions: Omit<SessionRow, "id">[]): Promise<void> {
  const old = await fs.collection("sessions").get();
  const batch = fs.batch();
  old.docs.forEach((d) => batch.delete(d.ref));
  sessions.forEach((s) => batch.set(fs.collection("sessions").doc(), s));
  await batch.commit();
}

export async function countSessions(): Promise<number> {
  return (await fs.collection("sessions").count().get()).data().count;
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

export async function saveCheckin(code: string, date: string, c: CheckinRow): Promise<void> {
  await fs.collection("checkins").doc(key(code, date)).set({ athlete_code: code, on_date: date, ...c });
}

export async function getCheckins(code: string, dates: string[]): Promise<Map<string, CheckinRow>> {
  const snaps = await fs.getAll(...dates.map((d) => fs.collection("checkins").doc(key(code, d))));
  const out = new Map<string, CheckinRow>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], { sleep_h: s.get("sleep_h"), soreness: s.get("soreness"), stress: s.get("stress"), note: s.get("note") ?? null }));
  return out;
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
}

export async function getSessionLogs(code: string, dates: string[]): Promise<Map<string, number>> {
  const snaps = await fs.getAll(...dates.map((d) => fs.collection("session_logs").doc(key(code, d))));
  const out = new Map<string, number>();
  snaps.forEach((s, i) => s.exists && out.set(dates[i], s.get("rpe")));
  return out;
}

export async function getProposal(code: string, date: string): Promise<ProposalRow | null> {
  const s = await fs.collection("proposals").doc(key(code, date)).get();
  return s.exists ? ({ id: s.id, ...s.data() } as ProposalRow) : null;
}

export async function saveProposal(p: Omit<ProposalRow, "id">): Promise<void> {
  await fs.collection("proposals").doc(key(p.athlete_code, p.on_date)).set(p);
}

export async function listProposals(limit: number): Promise<ProposalRow[]> {
  const q = await fs.collection("proposals").orderBy("created_at", "desc").limit(limit).get();
  return q.docs.map((d) => ({ id: d.id, ...d.data() }) as ProposalRow);
}

export async function decideProposal(id: string, status: "approved" | "rejected"): Promise<void> {
  const ref = fs.collection("proposals").doc(id);
  await fs.runTransaction(async (t) => {
    const s = await t.get(ref);
    if (s.exists && s.get("status") === "pending") t.update(ref, { status, decided_at: new Date().toISOString() });
  });
}

export async function getNotice(k: string): Promise<string | null> {
  const s = await fs.collection("notices").doc(k).get();
  return s.exists ? s.get("v") : null;
}

export async function setNotice(k: string, v: string | null): Promise<void> {
  const ref = fs.collection("notices").doc(k);
  if (v === null) await ref.delete();
  else await ref.set({ v });
}
