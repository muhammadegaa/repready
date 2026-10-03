"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { claimThisDevice, requirePlayer } from "@/lib/player-auth";
import { deregister, disconnectPolar as disconnect, syncPolar } from "@/lib/polar";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { PREVIEW } from "@/lib/wearables";
import { POSITIONS } from "@/lib/squad";
import {
  AVAILABILITY, type Availability, createPlayers, getInvite, inviteUsable, deleteAthleteData, getAthlete, giveConsentTo, logEvent, saveCheckin, saveReadiness, saveSessionLog, sessionBefore,
} from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const whole = (v: string, min: number, max: number) => /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max;
const tenth = (v: string, min: number, max: number) => /^\d+(\.\d)?$/.test(v) && Number(v) >= min && Number(v) <= max;
const half = (v: string, min: number, max: number) => /^\d+(\.5|\.0)?$/.test(v) && Number(v) >= min && Number(v) <= max;

// A player opens the club's squad link and adds themselves. They wait for staff to confirm before they can check in.
export async function joinSquad(f: FormData) {
  const token = text(f, "token");
  const path = `/join/${token}`;
  const fail = (msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);
  if (text(f, "website") !== "") return;
  const invite = await getInvite(token);
  if (!inviteUsable(invite) || invite.kind !== "squad") return fail("This link is no longer active. Ask your club for a new one.");
  const name = text(f, "name"), shirt = text(f, "shirt"), position = text(f, "position");
  if (!name || name.length > 80) return fail("Enter your name.");
  if (shirt !== "" && !/^\d{1,2}$/.test(shirt)) return fail("Shirt number is 1 or 2 digits.");
  if (f.get("adult") !== "yes") return fail("RepReady is for players aged 18 and over.");
  const [code] = await createPlayers(
    invite.club,
    [{ name, shirt: shirt === "" ? null : Number(shirt), position: (POSITIONS as readonly string[]).includes(position) ? position : "", squad: text(f, "squad").slice(0, 30) || "First team" }],
    { approved: false, via: "link" },
  );
  await claimThisDevice(code);
  redirect(`/a/${code}`);
}

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
  const sleep = text(f, "sleep_override") || text(f, "sleep_h"), soreness = text(f, "soreness"), stress = text(f, "stress");
  const note = text(f, "note").slice(0, 500);
  const availability = text(f, "availability") || "full";
  if (!(AVAILABILITY as string[]).includes(availability)) return;
  if (!tenth(sleep, 0, 16) || !whole(soreness, 0, 10) || !whole(stress, 0, 10)) return;
  const today = todayStr();
  await saveCheckin(code, today, { sleep_h: Number(sleep), soreness: Number(soreness), stress: Number(stress), note: note || null, availability: availability as Availability });
  await logEvent(a.club, {
    type: "checkin", athlete_code: code, athlete_name: a.name,
    text: `${a.name} checked in: ${sleep} h sleep, soreness ${soreness}, stress ${stress}${availability !== "full" ? `, availability ${availability}` : ""}${note ? ", with a note" : ""}`,
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
  const prev = await sessionBefore(a.club, today, a.group);
  if (date !== today && date !== prev?.on_date) return;
  await saveSessionLog(code, date, Number(rpe));
  await logEvent(a.club, { type: "rpe", athlete_code: code, athlete_name: a.name, text: `${a.name} logged session effort ${rpe} of 10` });
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
