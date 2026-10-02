"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { claimThisDevice, requirePlayer } from "@/lib/player-auth";
import { deregister, disconnectPolar as disconnect, syncPolar } from "@/lib/polar";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { PREVIEW } from "@/lib/wearables";
import {
  deleteAthleteData, getAthlete, giveConsentTo, logEvent, saveCheckin, saveReadiness, saveSessionLog, sessionBefore,
} from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const whole = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
const half = (v: string, min: number, max: number) => /^\d+(\.5|\.0)?$/.test(v) && Number(v) >= min && Number(v) <= max;

export async function giveConsent(f: FormData) {
  const code = text(f, "code");
  if (f.get("agree") !== "yes" || !(await getAthlete(code))) return;
  await giveConsentTo(code);
  await claimThisDevice(code); // the phone that agrees to the terms owns the link
  revalidatePath(`/a/${code}`);
}

// For a link that has agreed already but belongs to no phone yet, such as one the coach reset.
export async function claimDevice(f: FormData) {
  const code = text(f, "code");
  const a = await getAthlete(code);
  if (!a?.consented_at) return;
  await claimThisDevice(code);
  revalidatePath(`/a/${code}`);
}

export async function submitCheckin(f: FormData) {
  const code = text(f, "code");
  const a = await requirePlayer(code);
  const sleep = text(f, "sleep_h"), soreness = text(f, "soreness"), stress = text(f, "stress");
  const note = text(f, "note").slice(0, 500);
  if (!half(sleep, 0, 16) || !whole(soreness, 0, 10) || !whole(stress, 0, 10)) return;
  const today = todayStr();
  await saveCheckin(code, today, { sleep_h: Number(sleep), soreness: Number(soreness), stress: Number(stress), note: note || null });
  await logEvent({
    type: "checkin", athlete_code: code, athlete_name: a.name,
    text: `${a.name} checked in: ${sleep} h sleep, soreness ${soreness}, stress ${stress}${note ? ", with a note" : ""}`,
  });
  after(async () => {
    await syncPolar(code); // pulls last night from the device, if one is connected, so the agent sees it
    await runAgentFor(code, today);
  });
  revalidatePath(`/a/${code}`);
}

export async function logRpe(f: FormData) {
  const code = text(f, "code"), date = text(f, "date"), rpe = text(f, "rpe");
  const a = await requirePlayer(code);
  if (!half(rpe, 1, 10)) return;
  const today = todayStr();
  const prev = await sessionBefore(today);
  if (date !== today && date !== prev?.on_date) return;
  await saveSessionLog(code, date, Number(rpe));
  await logEvent({ type: "rpe", athlete_code: code, athlete_name: a.name, text: `${a.name} logged session effort ${rpe} of 10` });
  revalidatePath(`/a/${code}`);
}

export async function deleteMyData(f: FormData) {
  const code = text(f, "code");
  await requirePlayer(code);
  if (f.get("confirm") !== "yes") return;
  await deregister(code);
  await deleteAthleteData(code);
  redirect("/removed");
}

export async function previewWearable(f: FormData) {
  if (process.env.JUNCTION_API_KEY || process.env.NODE_ENV === "production") return;
  const code = text(f, "code");
  const sample = PREVIEW[text(f, "provider")];
  if (!sample) return;
  await requirePlayer(code);
  await saveReadiness(code, todayStr(), sample);
  revalidatePath(`/a/${code}`);
}

export async function syncPolarNow(f: FormData) {
  const code = text(f, "code");
  await requirePlayer(code);
  await syncPolar(code);
  revalidatePath(`/a/${code}`);
}

export async function disconnectPolar(f: FormData) {
  const code = text(f, "code");
  await requirePlayer(code);
  await disconnect(code);
  revalidatePath(`/a/${code}`);
}
