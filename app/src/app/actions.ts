"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { parseProgram } from "@/lib/program";
import { requireCoach, signIn, signOut } from "@/lib/coach-auth";
import { runAgentFor, todayStr } from "@/lib/run-agent";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const whole = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;

export async function coachLogin(f: FormData) {
  await signIn(text(f, "passcode"));
  revalidatePath("/coach");
}

export async function coachLogout() {
  await signOut();
  revalidatePath("/coach");
}

export async function addAthlete(f: FormData) {
  await requireCoach();
  const name = text(f, "name");
  if (!name || name.length > 80) return;
  db.prepare("insert into athlete (name, code) values (?, ?)").run(name, randomBytes(5).toString("hex"));
  revalidatePath("/coach");
}

export async function importProgram(f: FormData) {
  await requireCoach();
  const { sessions, errors } = parseProgram(text(f, "csv"));
  if (errors.length) {
    db.prepare("insert or replace into notice (k, v) values ('import', ?)").run(errors.join("\n"));
  } else {
    db.exec("delete from session");
    const ins = db.prepare("insert into session (on_date, label, week_type, exercises) values (?,?,?,?)");
    for (const s of sessions) ins.run(s.on_date, s.label, s.week_type, JSON.stringify(s.exercises));
    db.prepare("delete from notice where k = 'import'").run();
  }
  revalidatePath("/coach");
}

export async function decide(f: FormData) {
  await requireCoach();
  const id = Number(text(f, "id"));
  const intent = text(f, "intent");
  if (!Number.isInteger(id) || (intent !== "approve" && intent !== "reject")) return;
  db.prepare("update proposal set status = ?, decided_at = ? where id = ? and status = 'pending'").run(
    intent === "approve" ? "approved" : "rejected", new Date().toISOString(), id,
  );
  revalidatePath("/coach");
}

export async function giveConsent(f: FormData) {
  const code = text(f, "code");
  if (f.get("agree") !== "yes") return;
  db.prepare("update athlete set consented_at = ? where code = ? and consented_at is null").run(new Date().toISOString(), code);
  revalidatePath(`/a/${code}`);
}

export async function submitCheckin(f: FormData) {
  const code = text(f, "code");
  const a = db.prepare("select id, consented_at from athlete where code = ?").get(code) as { id: number; consented_at: string | null } | undefined;
  if (!a || !a.consented_at) return;
  const sleep = text(f, "sleep_h"), soreness = text(f, "soreness"), stress = text(f, "stress"), lastRpe = text(f, "last_rpe");
  const note = text(f, "note").slice(0, 500);
  if (!/^\d+(\.\d)?$/.test(sleep) || Number(sleep) > 16 || !whole(soreness, 0, 10) || !whole(stress, 0, 10)) return;
  const today = todayStr();

  if (lastRpe !== "") {
    if (!/^\d+(\.\d)?$/.test(lastRpe) || Number(lastRpe) < 1 || Number(lastRpe) > 10) return;
    const prev = db.prepare("select on_date from session where on_date < ? order by on_date desc limit 1").get(today) as { on_date: string } | undefined;
    if (prev) db.prepare("insert or replace into session_log (athlete_id, on_date, rpe) values (?,?,?)").run(a.id, prev.on_date, Number(lastRpe));
  }
  db.prepare("insert or replace into checkin (athlete_id, on_date, sleep_h, soreness, stress, note) values (?,?,?,?,?,?)").run(
    a.id, today, Number(sleep), Number(soreness), Number(stress), note || null,
  );
  await runAgentFor(a.id, today);
  revalidatePath(`/a/${code}`);
  revalidatePath("/coach");
}
