"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { buildEdits, COACH_LIMITS } from "@/lib/edits";
import { deregister } from "@/lib/polar";
import { describeReport, resolveProgram } from "@/lib/library/resolve";
import { parseFixtures } from "@/lib/fixtures";
import { parseProgram } from "@/lib/program";
import { parsePlayers, POSITIONS } from "@/lib/squad";
import {
  approvePlayer, CODE_RE, createPlayers, decideProposal, deleteAthleteData, getAthlete, getProposal, replaceSessions, resetLink, sessionOn, setFixtures, setNotice, setProtected,
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
  const [p, session] = await Promise.all([getProposal(code, date), sessionOn(club, date)]);
  if (!p || !session) return back("That session no longer exists.");
  const { edits, error } = buildEdits((k) => text(f, k), session.exercises, COACH_LIMITS);
  if (error) return back(error);
  if (!edits.length) return back("No changes entered. Use Approve to accept the proposal as it is.");
  await decideProposal(club, id, "approved", { note: text(f, "note").slice(0, 300), edits });
  revalidatePath("/coach");
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
