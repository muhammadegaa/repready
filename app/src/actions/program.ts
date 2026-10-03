"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { describeReport, resolveProgram } from "@/lib/library/resolve";
import { fileToText } from "@/lib/read/files";
import { ask, ModelUnavailable } from "@/lib/read/model";
import { addDays, blocking, defaultWeekStart, issuesOf, readProgram, reviseProgram, type ProgramDraft } from "@/lib/read/program";
import { todayStr } from "@/lib/run-agent";
import { closeDraft, createDraft, getDraft, getFixtures, replaceSessionsInRange, saveDraft } from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const MAX_TEXT = 30_000;

const MANUAL = " Nothing was changed. Try again in a minute.";
const back = (path: string, key: string, msg: string): never => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

// The coach gives whatever they have: pasted text, a spreadsheet, or both. The assistant reads it into a draft to review.
export async function readProgramAction(f: FormData) {
  const { club, name } = await requireStaff("coach");
  const today = todayStr();
  const weekStart = isDate(text(f, "week_start")) ? text(f, "week_start") : defaultWeekStart(today);

  let body = text(f, "text");
  const file = f.get("file");
  if (file instanceof File && file.size > 0) {
    const r = await fileToText(file.name, new Uint8Array(await file.arrayBuffer()));
    if ("error" in r) return back("/coach/program", "readerr", r.error);
    body = [body, r.text].filter(Boolean).join("\n\n");
  }
  if (!body) return back("/coach/program", "readerr", "Paste your program, or choose a file, then press Read my program.");
  if (body.length > MAX_TEXT) return back("/coach/program", "readerr", "That is a lot at once. Give me one week at a time.");

  let draft: ProgramDraft;
  try {
    draft = await readProgram(ask, { text: body, weekStart, today, fixtures: await getFixtures(club) });
  } catch (e) {
    if (e instanceof ModelUnavailable) return back("/coach/program", "readerr", e.message + MANUAL);
    throw e;
  }
  const id = await createDraft(club, name, draft);
  redirect(`/coach/program/review/${id}`);
}

async function open(club: string, id: string) {
  const d = await getDraft(club, id);
  if (!d || d.status !== "open") return null;
  return d;
}

// The coach fixes what the assistant could not know: a missing date, or a session that should not be there.
export async function fixDraft(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  const d = await open(club, id);
  if (!d) return redirect("/coach/program");
  const sessions = d.program.sessions
    .map((s, i) => {
      if (f.get(`drop_${i}`) === "yes") return null;
      const picked = text(f, `date_${i}`);
      return isDate(picked) ? { ...s, date: picked, how: "written" as const } : s;
    })
    .filter((s): s is ProgramDraft["sessions"][number] => s !== null);
  await saveDraft(club, id, { ...d.program, sessions }, d.revisions);
  redirect(`/coach/program/review/${id}`);
}

// "Reserves also train on Tuesday": the coach says what is wrong in plain words and the assistant redoes the draft.
export async function reviseDraft(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  const d = await open(club, id);
  if (!d) return redirect("/coach/program");
  const instruction = text(f, "instruction");
  const here = `/coach/program/review/${id}`;
  if (!instruction) return back(here, "err", "Say what to change, for example: reserves also train on Tuesday.");
  if (d.revisions >= 8) return back(here, "err", "That is a lot of changes. Discard this one and start again with the corrected text.");
  try {
    const next = await reviseProgram(ask, d.program, instruction, { weekStart: d.program.week_start, today: todayStr(), fixtures: await getFixtures(club) });
    await saveDraft(club, id, next, d.revisions + 1);
  } catch (e) {
    if (e instanceof ModelUnavailable) return back(here, "err", e.message);
    throw e;
  }
  redirect(here);
}

export async function applyDraft(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  const d = await open(club, id);
  if (!d) return redirect("/coach/program");
  const here = `/coach/program/review/${id}`;
  const stop = blocking(issuesOf(d.program, todayStr()));
  if (stop.length) return back(here, "err", stop[0].text);

  const dated = d.program.sessions.filter((s): s is typeof s & { date: string } => s.date !== null);
  const { sessions, report } = resolveProgram(dated.map((s) => ({ on_date: s.date, label: s.label, week_type: s.week_type, exercises: s.exercises, group: s.group })));
  const dates = dated.map((s) => s.date).sort();
  // The week it was read for, widened if sessions fall outside it, so a replaced week is replaced whole.
  const from = [d.program.week_start, dates[0]].sort()[0];
  const to = [addDays(d.program.week_start, 6), dates[dates.length - 1]].sort().reverse()[0];
  await replaceSessionsInRange(club, sessions, from, to);
  await closeDraft(club, id, "applied");
  revalidatePath("/coach");
  revalidatePath("/coach/program");
  const note = describeReport(report);
  redirect(`/coach/program?applied=${encodeURIComponent(`Saved ${sessions.length} session${sessions.length === 1 ? "" : "s"} for ${from} to ${to}.${note ? ` ${note}` : ""}`)}`);
}

export async function discardDraft(f: FormData) {
  const { club } = await requireStaff("coach");
  const id = text(f, "id");
  if (await open(club, id)) await closeDraft(club, id, "discarded");
  redirect("/coach/program");
}
