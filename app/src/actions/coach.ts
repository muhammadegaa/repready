"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { buildEdits, COACH_LIMITS } from "@/lib/edits";
import { deregister } from "@/lib/polar";
import { cleanGroup, GROUP_MAX, groupLabel } from "@/lib/groups";
import { loadSampleSquad, removeSampleSquad } from "@/lib/sample";
import { readFixtureDates } from "@/lib/fixtures";
import { planFor, playerExerciseNames } from "@/lib/plan";
import { validateOverride } from "@/lib/overrides";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { KEYS, type TKey } from "@/lib/agent/thresholds";
import { suggestions } from "@/lib/tuning";
import { isRoutine, ruleStats } from "@/lib/autonomy";
import { allRules } from "@/lib/rules";
import { cleanCalendarUrl } from "@/lib/calendar";
import { syncCalendar } from "@/lib/calendar-sync";
import { readMinutes } from "@/lib/minutes";
import { fileToText } from "@/lib/read/files";
import { POSITIONS, readSquad, storedPlayers } from "@/lib/squad";
import {
  approvePlayer, CODE_RE, getTuning, setThreshold, snoozeThreshold, getAutonomy, listProposals, setAskAlways, setAutonomy, undoDelegated, saveCalendarLink, getNotice, listAthletes, saveMinutes, createPlayers, decideProposal, deleteAthleteData, getAthlete, getProposal, resetLink, createOverride, liftOverride, setFixtures, setGroup, setNotice, setProtected,
} from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const PROPOSAL_ID = /^[0-9a-f]{16}_\d{4}-\d{2}-\d{2}$/;
const back = (msg: string) => redirect(`/coach?notice=${encodeURIComponent(msg)}`);

// A staff member can only act on players of their own club.
async function ownPlayer(club: string, code: string) {
  if (!CODE_RE.test(code)) return null;
  const a = await getAthlete(code);
  return a && a.club === club ? a : null;
}

export async function addPlayer(f: FormData) {
  const { club } = await requireStaff("coach");
  const name = text(f, "name");
  const shirt = text(f, "shirt");
  const position = text(f, "position");
  const squad = text(f, "squad") || "First team";
  if (!name || name.length > 80 || (shirt !== "" && !/^\d{1,2}$/.test(shirt)) || squad.length > 30) return;
  await createPlayers(club, [{ name, shirt: shirt === "" ? null : Number(shirt), position: (POSITIONS as readonly string[]).includes(position) ? position : "", squad }]);
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  redirect(`/coach/squad?added=${encodeURIComponent(name)}`);
}

// The coach gives a list however they have it (pasted, or a spreadsheet); it is read here, with no outside service,
// and shown back for a check before anyone is added.
export async function readSquadAction(f: FormData) {
  const { club } = await requireStaff("coach");
  let raw = text(f, "list");
  const file = f.get("file");
  if (file instanceof File && file.size > 0) {
    const r = await fileToText(file.name, new Uint8Array(await file.arrayBuffer()));
    if ("error" in r) {
      await setNotice(club, "squad", r.error);
      revalidatePath("/coach/squad");
      return redirect("/coach/squad");
    }
    raw = [raw, r.text].filter(Boolean).join("\n");
  }
  const { players, skipped, tooMany } = readSquad(raw.slice(0, 40000));
  if (!players.length) {
    await setNotice(club, "squad", raw ? "I could not find any names in that. One player per line is enough." : "Paste your squad, or choose a file, then press Read my squad.");
    await setNotice(club, "squad_preview", null);
  } else {
    await setNotice(club, "squad", null);
    await setNotice(club, "squad_preview", JSON.stringify({ players, skipped: skipped.slice(0, 10), tooMany }));
  }
  revalidatePath("/coach/squad");
  redirect("/coach/squad");
}

export async function confirmSquad() {
  const { club } = await requireStaff("coach");
  const raw = await getNotice(club, "squad_preview");
  await setNotice(club, "squad_preview", null);
  const players = storedPlayers(raw);
  if (players.length) await createPlayers(club, players);
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  redirect(players.length ? `/coach/squad?added=${players.length}` : "/coach/squad");
}

export async function discardSquadPreview() {
  const { club } = await requireStaff("coach");
  await setNotice(club, "squad_preview", null);
  revalidatePath("/coach/squad");
  redirect("/coach/squad");
}

// Puts the ticked players in a group (or back to Everyone). Only this club's own players are touched.
export async function setGroupForMany(f: FormData) {
  const { club } = await requireStaff("coach");
  const raw = text(f, "group");
  if (raw.length > GROUP_MAX) return redirect(`/coach/squad?grouperr=${encodeURIComponent(`Group names are at most ${GROUP_MAX} characters.`)}`);
  const group = cleanGroup(raw);
  const codes = [...new Set(f.getAll("code").map(String))].slice(0, 200);
  if (!codes.length) return redirect(`/coach/squad?grouperr=${encodeURIComponent("Tick at least one player first.")}`);
  let moved = 0;
  for (const code of codes) {
    const a = await ownPlayer(club, code);
    if (!a) continue;
    await setGroup(a.code, group);
    moved++;
  }
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  redirect(`/coach/squad?grouped=${encodeURIComponent(`${moved} player${moved === 1 ? "" : "s"} now in ${groupLabel(group)}.`)}`);
}

export async function setPlayerGroup(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  const raw = text(f, "group");
  if (!a || raw.length > GROUP_MAX) return;
  await setGroup(a.code, cleanGroup(raw));
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  revalidatePath(`/coach/athletes/${a.code}`);
}

// Fictional players with history, flagged and removable, so every screen can be seen working before real players are added.
export async function loadSample() {
  const { club } = await requireStaff("coach");
  const r = await loadSampleSquad(club);
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  redirect(`/coach?notice=${encodeURIComponent(
    r === "exists" ? "A sample squad is already loaded." : `Sample squad loaded: ${r.players} fictional players${r.program ? " and a sample program" : ""}. Remove it any time from Squad.`,
  )}`);
}

export async function removeSample(f: FormData) {
  const { club } = await requireStaff("coach");
  if (f.get("confirm") !== "yes") return redirect(`/coach/squad?grouperr=${encodeURIComponent("Tick the box to confirm removing the sample squad.")}`);
  const n = await removeSampleSquad(club);
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  redirect(`/coach?notice=${encodeURIComponent(`Removed the sample squad (${n} players). Your own players and program were not touched.`)}`);
}

export async function resetPlayerLink(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  if (!a) return;
  await resetLink(a.code);
  revalidatePath("/coach/squad");
}

export async function confirmPlayer(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  if (!a) return;
  await approvePlayer(a.code);
  revalidatePath("/coach/squad");
}

export async function removeAthlete(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  if (f.get("confirm") !== "yes" || !a) return;
  await deregister(a.code);
  await deleteAthleteData(a.code);
  redirect("/coach/squad");
}

export async function saveFixtureList(f: FormData) {
  const { club } = await requireStaff("coach");
  const { dates, unreadable } = readFixtureDates(text(f, "fixtures"), todayStr());
  await setFixtures(club, dates);
  await setNotice(club, "fixtures", unreadable.length ? `Saved ${dates.length} match date${dates.length === 1 ? "" : "s"}. I could not find a date in: ${unreadable.map((l) => `"${l}"`).join(", ")}` : null);
  revalidatePath("/coach/program");
  redirect("/coach/program");
}

async function decide(f: FormData, status: "approved" | "rejected") {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  if (!PROPOSAL_ID.test(id)) return;
  await decideProposal(club, id, status, { note: text(f, "note").slice(0, 300) });
  revalidatePath("/coach");
}

export const approveProposal = async (f: FormData) => decide(f, "approved");
export const keepPlan = async (f: FormData) => decide(f, "rejected");

export async function approveEdited(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  if (!PROPOSAL_ID.test(id) || id.slice(0, 6) !== club) return;
  const [code, date] = [id.slice(0, 16), id.slice(17)];
  const a = await ownPlayer(club, code);
  const [p, plan] = await Promise.all([getProposal(code, date), a ? planFor(a, date) : null]);
  if (!a || !p || !plan) return back("That session no longer exists.");
  // The form's rows are the player's own plan (group version, then their overrides), the same list the proposal card showed.
  const { edits, error } = buildEdits((k) => text(f, k), plan.resolved.exercises, COACH_LIMITS);
  if (error) return back(error);
  if (!edits.length) return back("No changes entered. Use Approve to accept the proposal as it is.");
  await decideProposal(club, id, "approved", { note: text(f, "note").slice(0, 300), edits });
  revalidatePath("/coach");
}

// A coach's standing instruction for one player and one exercise. The rules then work from the changed plan, so a proposal
// made before the change is made again (a proposal the coach has already decided is left alone).
export async function addPlanOverride(f: FormData) {
  const { club, name } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  if (!a) return;
  const today = todayStr();
  const here = `/coach/athletes/${a.code}`;
  const checked = validateOverride(
    { exercise: text(f, "exercise"), swap_to: text(f, "swap_to"), max_sets: text(f, "max_sets"), max_reps: text(f, "max_reps"), load_pct: text(f, "load_pct"), until: text(f, "until"), review_on: text(f, "review_on"), note: text(f, "note") },
    await playerExerciseNames(a, today), today,
  );
  if (!checked.ok) return redirect(`${here}?overrideerr=${encodeURIComponent(checked.error)}#plan-changes`);
  await createOverride(a.code, { ...checked.value, created_by: name });
  after(async () => { await runAgentFor(a.code, today); });
  revalidatePath(here);
  revalidatePath("/coach");
  redirect(`${here}?overrideok=${encodeURIComponent(`Saved. ${a.name.split(" ")[0]} now has this change from the next session that includes ${checked.value.exercise}.`)}#plan-changes`);
}

export async function liftPlanOverride(f: FormData) {
  const { club, name } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  const id = text(f, "id");
  if (!a || !/^[A-Za-z0-9]{10,40}$/.test(id)) return;
  if (await liftOverride(a.code, id, name)) after(async () => { await runAgentFor(a.code, todayStr()); });
  revalidatePath(`/coach/athletes/${a.code}`);
  revalidatePath("/coach");
  redirect(`/coach/athletes/${a.code}?overrideok=${encodeURIComponent("Lifted. The player is back on the program.")}#plan-changes`);
}

export async function toggleProtected(f: FormData) {
  const { club } = await requireStaff("coach");
  const exercise = text(f, "exercise");
  const a = await ownPlayer(club, text(f, "code"));
  if (!a || !exercise || exercise.length > 60) return;
  const has = a.protected.includes(exercise);
  await setProtected(a.code, has ? a.protected.filter((x) => x !== exercise) : [...a.protected, exercise]);
  revalidatePath(`/coach/athletes/${a.code}`);
}

// Match minutes: a coach jots who played; names are matched in our own code, shown for a check, then saved.
const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

export async function readMinutesAction(f: FormData) {
  const { club } = await requireStaff("coach");
  const date = text(f, "date");
  const raw = text(f, "minutes").slice(0, 8000);
  if (!isoDate(date) || date > todayStr()) {
    await setNotice(club, "minutes", "Choose the date of the match. It cannot be in the future.");
  } else {
    const { rows, unmatched } = readMinutes(raw, (await listAthletes(club)).filter((a) => a.approved).map((a) => ({ code: a.code, name: a.name })));
    if (!rows.length) await setNotice(club, "minutes", raw ? "I could not match any of those lines to a player. Use the player's name and their minutes, one per line." : "Paste who played and for how long, one player per line.");
    else {
      await setNotice(club, "minutes", null);
      await setNotice(club, "minutes_preview", JSON.stringify({ date, rows, unmatched: unmatched.slice(0, 10) }));
    }
  }
  revalidatePath("/coach/program");
  redirect("/coach/program#minutes");
}

export async function confirmMinutes() {
  const { club } = await requireStaff("coach");
  const stored = await getNotice(club, "minutes_preview");
  await setNotice(club, "minutes_preview", null);
  try {
    const d = JSON.parse(stored ?? "") as { date: string; rows: { code: string; name: string; minutes: number }[] };
    const mine = new Set((await listAthletes(club)).map((a) => a.code));
    const rows = d.rows.filter((r) => mine.has(r.code) && Number.isInteger(r.minutes) && r.minutes >= 0 && r.minutes <= 130);
    if (isoDate(d.date) && rows.length) await saveMinutes(club, d.date, rows);
  } catch { /* nothing valid was waiting */ }
  revalidatePath("/coach");
  redirect("/coach/program?applied=" + encodeURIComponent("Match minutes saved."));
}

export async function discardMinutes() {
  const { club } = await requireStaff("coach");
  await setNotice(club, "minutes_preview", null);
  redirect("/coach/program#minutes");
}

// A club calendar link keeps the fixtures up to date by itself. It is read now, to show the coach what was taken, and again each morning.
export async function saveCalendarAction(f: FormData) {
  const { club } = await requireStaff("coach");
  const raw = text(f, "calendar");
  if (!cleanCalendarUrl(raw)) {
    await setNotice(club, "fixtures", "That does not look like a calendar link. It should start with https:// or webcal://.");
  } else {
    await saveCalendarLink(club, { url: raw.replace(/^webcal:\/\//i, "https://"), synced_at: null, dates: [], examples: [], error: null });
    const r = await syncCalendar(club);
    await setNotice(club, "fixtures", r.ok ? (r.count ? null : "The calendar opened, but I found no events that look like matches. Matches should have “v”, “vs” or “match” in the title.") : r.error);
  }
  revalidatePath("/coach/program");
  redirect("/coach/program#fixtures");
}

export async function removeCalendarAction() {
  const { club } = await requireStaff("coach");
  await saveCalendarLink(club, null);
  revalidatePath("/coach/program");
  redirect("/coach/program#fixtures");
}

// ---- the autonomy ladder
// Level 1: the coach looks at today's routine suggestions together and approves them in one action.
export async function approveRoutine() {
  const { club } = await requireStaff("coach");
  const today = todayStr();
  const routine = (await listProposals(club, 200)).filter((p) => p.on_date === today && isRoutine(p));
  for (const p of routine) await decideProposal(club, p.id, "approved", { by: "coach" });
  revalidatePath("/coach");
  redirect("/coach");
}

// Level 2: hand a rule to the agent. Only a rule the coach has earned the right to hand over (enough decisions, nine in ten as proposed).
export async function setDelegation(f: FormData) {
  const { club } = await requireStaff("coach");
  const rule = text(f, "rule");
  const on = text(f, "on") === "yes";
  const a = await getAutonomy(club);
  const ids = (await allRules(club)).map((r) => r.id);
  if (!ids.includes(rule)) return redirect("/coach/results#autonomy");
  if (on) {
    const stat = ruleStats(await listProposals(club, 500), todayStr(), ids).find((s) => s.rule === rule);
    if (!stat?.eligible) return redirect(`/coach/results?autoerr=${encodeURIComponent("That rule has not earned this yet. It needs at least 8 of your decisions in the last 28 days, with 9 in 10 approved as proposed.")}#autonomy`);
    await setAutonomy(club, { ...a, delegated: [...new Set([...a.delegated, rule])] });
  } else {
    await setAutonomy(club, { ...a, delegated: a.delegated.filter((r) => r !== rule) });
  }
  revalidatePath("/coach/results");
  redirect("/coach/results#autonomy");
}

export async function setAutopilotPaused(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await getAutonomy(club);
  await setAutonomy(club, { ...a, paused: text(f, "paused") === "yes" });
  revalidatePath("/coach/results");
  redirect("/coach/results#autonomy");
}

export async function takeBack(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  if (PROPOSAL_ID.test(id)) await undoDelegated(club, id);
  revalidatePath("/coach");
  redirect("/coach");
}

export async function askAlwaysAction(f: FormData) {
  const { club } = await requireStaff("coach");
  const a = await ownPlayer(club, text(f, "code"));
  if (a) await setAskAlways(a.code, text(f, "on") === "yes");
  revalidatePath(`/coach/athletes/${text(f, "code")}`);
  redirect(`/coach/athletes/${text(f, "code")}`);
}

// ---- tuning a rule's number, from a suggestion the coach chose to accept
const tkey = (f: FormData): TKey | null => (KEYS.includes(text(f, "key") as TKey) ? (text(f, "key") as TKey) : null);

export async function applyTuning(f: FormData) {
  const { club, name } = await requireStaff("coach");
  const key = tkey(f);
  if (key) {
    // Worked out again here from the coach's record, so a stale or forged form cannot set any other number.
    const s = suggestions(await listProposals(club, 500), (await getTuning(club)).thresholds, todayStr(), await getTuning(club)).find((x) => x.key === key);
    if (s) await setThreshold(club, key, s.to, name);
  }
  revalidatePath("/coach/results");
  redirect("/coach/results#rules");
}

export async function dismissTuning(f: FormData) {
  const { club } = await requireStaff("coach");
  const key = tkey(f);
  if (key) {
    const until = new Date(`${todayStr()}T00:00:00Z`);
    until.setUTCDate(until.getUTCDate() + 14);
    await snoozeThreshold(club, key, until.toISOString().slice(0, 10));
  }
  revalidatePath("/coach/results");
  redirect("/coach/results#rules");
}

export async function resetTuning(f: FormData) {
  const { club, name } = await requireStaff("coach");
  const key = tkey(f);
  if (key) await setThreshold(club, key, null, name);
  revalidatePath("/coach/results");
  redirect("/coach/results#rules");
}
