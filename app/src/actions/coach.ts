"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { buildEdits, COACH_LIMITS } from "@/lib/edits";
import { deregister } from "@/lib/polar";
import { cleanGroup, GROUP_MAX, groupLabel } from "@/lib/groups";
import { describeReport, resolveProgram } from "@/lib/library/resolve";
import { parseFixtures } from "@/lib/fixtures";
import { planFor, playerExerciseNames } from "@/lib/plan";
import { validateOverride } from "@/lib/overrides";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { parseProgram } from "@/lib/program";
import { parsePlayers, POSITIONS } from "@/lib/squad";
import {
  approvePlayer, CODE_RE, createPlayers, decideProposal, deleteAthleteData, getAthlete, getProposal, replaceSessions, resetLink, createOverride, liftOverride, setFixtures, setGroup, setNotice, setProtected,
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

export async function addPlayers(f: FormData) {
  const { club } = await requireStaff("coach");
  const raw = text(f, "list");
  const { players, errors } = parsePlayers(raw);
  if (errors.length) {
    // Keep what was pasted so one bad line does not cost the coach the whole list.
    await setNotice(club, "squad", errors.join("\n"));
    await setNotice(club, "squad_list", raw.slice(0, 20000));
  } else if (players.length) {
    await createPlayers(club, players);
    await setNotice(club, "squad", null);
    await setNotice(club, "squad_list", null);
  }
  revalidatePath("/coach");
  revalidatePath("/coach/squad");
  if (!errors.length && players.length) redirect(`/coach/squad?added=${players.length}`);
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

export async function importProgram(f: FormData) {
  const { club } = await requireStaff("coach");
  const { sessions, errors } = parseProgram(text(f, "csv"));
  if (errors.length) {
    await setNotice(club, "import", errors.join("\n"));
  } else {
    const resolved = resolveProgram(sessions);
    await replaceSessions(club, resolved.sessions);
    await setNotice(club, "import", describeReport(resolved.report));
  }
  revalidatePath("/coach");
  redirect("/coach/program");
}

export async function saveFixtureList(f: FormData) {
  const { club } = await requireStaff("coach");
  const { dates, errors } = parseFixtures(text(f, "fixtures"));
  if (errors.length) await setNotice(club, "fixtures", errors.join("\n"));
  else {
    await setFixtures(club, dates);
    await setNotice(club, "fixtures", null);
  }
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
