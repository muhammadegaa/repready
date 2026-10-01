"use server";

import { revalidatePath } from "next/cache";
import { parseProgram } from "@/lib/program";
import { requireCoach, signIn, signOut } from "@/lib/coach-auth";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { createAthlete, decideProposal, deleteAthleteData, getAthlete, giveConsentTo, replaceSessions, saveCheckin, saveReadiness, saveSessionLog, sessionBefore, setNotice } from "@/lib/store";
import { PREVIEW } from "@/lib/wearables";

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
  await createAthlete(name);
  revalidatePath("/coach");
}

export async function removeAthlete(f: FormData) {
  await requireCoach();
  const code = text(f, "code");
  if (f.get("confirm") !== "yes" || !/^[0-9a-f]{10}$/.test(code)) return;
  await deleteAthleteData(code);
  revalidatePath("/coach");
}

export async function importProgram(f: FormData) {
  await requireCoach();
  const { sessions, errors } = parseProgram(text(f, "csv"));
  if (errors.length) {
    await setNotice("import", errors.join("\n"));
  } else {
    await replaceSessions(sessions);
    await setNotice("import", null);
  }
  revalidatePath("/coach");
}

export async function decide(f: FormData) {
  await requireCoach();
  const id = text(f, "id");
  const intent = text(f, "intent");
  if (!/^[0-9a-f]{10}_\d{4}-\d{2}-\d{2}$/.test(id) || (intent !== "approve" && intent !== "reject")) return;
  await decideProposal(id, intent === "approve" ? "approved" : "rejected");
  revalidatePath("/coach");
}

export async function giveConsent(f: FormData) {
  const code = text(f, "code");
  if (f.get("agree") !== "yes" || !(await getAthlete(code))) return;
  await giveConsentTo(code);
  revalidatePath(`/a/${code}`);
}

export async function submitCheckin(f: FormData) {
  const code = text(f, "code");
  const a = await getAthlete(code);
  if (!a || !a.consented_at) return;
  const sleep = text(f, "sleep_h"), soreness = text(f, "soreness"), stress = text(f, "stress"), lastRpe = text(f, "last_rpe");
  const note = text(f, "note").slice(0, 500);
  if (!/^\d+(\.\d)?$/.test(sleep) || Number(sleep) > 16 || !whole(soreness, 0, 10) || !whole(stress, 0, 10)) return;
  const today = todayStr();

  if (lastRpe !== "") {
    if (!/^\d+(\.\d)?$/.test(lastRpe) || Number(lastRpe) < 1 || Number(lastRpe) > 10) return;
    const prev = await sessionBefore(today);
    if (prev) await saveSessionLog(code, prev.on_date, Number(lastRpe));
  }
  await saveCheckin(code, today, { sleep_h: Number(sleep), soreness: Number(soreness), stress: Number(stress), note: note || null });
  await runAgentFor(code, today);
  revalidatePath(`/a/${code}`);
  revalidatePath("/coach");
}

export async function previewWearable(f: FormData) {
  if (process.env.JUNCTION_API_KEY || process.env.NODE_ENV === "production") return;
  const code = text(f, "code");
  const sample = PREVIEW[text(f, "provider")];
  if (!sample || !(await getAthlete(code))) return;
  await saveReadiness(code, todayStr(), sample);
  revalidatePath(`/a/${code}`);
  revalidatePath("/coach");
}
