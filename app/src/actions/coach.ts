"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { buildEdits, COACH_LIMITS } from "@/lib/edits";
import { deregister } from "@/lib/polar";
import { parseProgram } from "@/lib/program";
import {
  createAthlete, decideProposal, deleteAthleteData, getAthlete, getProposal, replaceSessions, sessionOn, setNotice, setProtected,
} from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const CODE = /^[0-9a-f]{10}$/;
const PROPOSAL_ID = /^[0-9a-f]{10}_\d{4}-\d{2}-\d{2}$/;
const back = (msg: string) => redirect(`/coach?notice=${encodeURIComponent(msg)}`);

export async function addAthlete(f: FormData) {
  await requireRole("coach");
  const name = text(f, "name");
  if (!name || name.length > 80) return;
  await createAthlete(name);
  revalidatePath("/coach");
}

export async function removeAthlete(f: FormData) {
  await requireRole("coach");
  const code = text(f, "code");
  if (f.get("confirm") !== "yes" || !CODE.test(code)) return;
  await deregister(code);
  await deleteAthleteData(code);
  redirect("/coach?notice=" + encodeURIComponent("Athlete and their data removed."));
}

export async function importProgram(f: FormData) {
  await requireRole("coach");
  const { sessions, errors } = parseProgram(text(f, "csv"));
  if (errors.length) {
    await setNotice("import", errors.join("\n"));
  } else {
    await replaceSessions(sessions);
    await setNotice("import", null);
  }
  revalidatePath("/coach");
  redirect("/coach/program");
}

export async function approveProposal(f: FormData) {
  await requireRole("coach");
  const id = text(f, "id");
  if (!PROPOSAL_ID.test(id)) return;
  await decideProposal(id, "approved", { note: text(f, "note").slice(0, 300) });
  revalidatePath("/coach");
}

export async function approveEdited(f: FormData) {
  await requireRole("coach");
  const id = text(f, "id");
  if (!PROPOSAL_ID.test(id)) return;
  const [code, date] = [id.slice(0, 10), id.slice(11)];
  const [p, session] = await Promise.all([getProposal(code, date), sessionOn(date)]);
  if (!p || !session) return back("That session no longer exists.");
  const { edits, error } = buildEdits((k) => text(f, k), session.exercises, COACH_LIMITS);
  if (error) return back(error);
  if (!edits.length) return back("No changes entered. Use Approve to accept the proposal as it is.");
  await decideProposal(id, "approved", { note: text(f, "note").slice(0, 300), edits });
  revalidatePath("/coach");
}

export async function keepPlan(f: FormData) {
  await requireRole("coach");
  const id = text(f, "id");
  if (!PROPOSAL_ID.test(id)) return;
  await decideProposal(id, "rejected", { note: text(f, "note").slice(0, 300) });
  revalidatePath("/coach");
}

export async function toggleProtected(f: FormData) {
  await requireRole("coach");
  const code = text(f, "code"), exercise = text(f, "exercise");
  if (!CODE.test(code) || !exercise || exercise.length > 60) return;
  const a = await getAthlete(code);
  if (!a) return;
  const has = a.protected.includes(exercise);
  await setProtected(code, has ? a.protected.filter((x) => x !== exercise) : [...a.protected, exercise]);
  revalidatePath(`/coach/athletes/${code}`);
}
