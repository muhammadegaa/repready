"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import { draftNextWeek } from "@/actions/program";
import { draftPreview, findPlayer, needsMe, notIn, respond, type Action, type Person, type Reply } from "@/lib/ask/respond";
import { COMMANDS, understand } from "@/lib/ask/understand";
import { validateOverride } from "@/lib/overrides";
import { playerExerciseNames } from "@/lib/plan";
import { ask, ModelUnavailable } from "@/lib/read/model";
import { runAgentFor, todayStr } from "@/lib/run-agent";
import { createOverride, listAthletes, listSessions, logEvent, saveMinutes } from "@/lib/store";
import { coachToday, STATUS } from "@/lib/views";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function people(club: string, today: string): Promise<Person[]> {
  const { roster } = await coachToday(club, today);
  return roster.map((r) => ({
    code: r.athlete.code,
    name: r.athlete.name,
    status: r.status,
    statusLabel: STATUS[r.status].label,
    proposal: r.proposal ? { id: r.proposal.id, decision: r.proposal.decision, reason: r.proposal.reason, rules: r.proposal.rules_applied, flag: r.proposal.flag, edits: r.proposal.edits, status: r.proposal.status } : null,
    exercises: [],
  }));
}

// The coach's sentence, or one of the buttons. The buttons never reach the model.
export async function askAction(_prev: Reply | null, f: FormData): Promise<Reply> {
  const { club } = await requireStaff("coach");
  const today = todayStr();
  const direct = COMMANDS.find((c) => c.intent === text(f, "direct"));
  const sentence = text(f, "q").slice(0, 500);
  if (!direct && !sentence) return { kind: "error", message: "Type what you want, or use one of the buttons." };
  const everyone = await people(club, today);
  if (direct) return direct.intent === "needs_me" ? needsMe(everyone) : direct.intent === "not_in" ? notIn(everyone) : draftPreview();
  try {
    const upcoming = await listSessions(club, today, 80);
    const exercises = [...new Set(upcoming.flatMap((s) => s.exercises.map((e) => e.name)))].sort();
    const u = await understand(ask, { sentence, today, names: everyone.map((p) => p.name), exercises });
    if (u.intent === "standing_change") {
      const hit = findPlayer(u.player, everyone);
      if ("person" in hit) {
        const a = (await listAthletes(club)).find((x) => x.code === hit.person.code);
        if (a) hit.person.exercises = await playerExerciseNames(a, today);
      }
    }
    return respond(u, everyone, today);
  } catch (e) {
    if (e instanceof ModelUnavailable) return { kind: "error", message: `${e.message} The buttons below still work.` };
    throw e;
  }
}

// The coach confirmed a preview. Nothing the browser sends is trusted: the player, the exercise and the numbers are checked again
// against the same rules as the forms on the player's page and the minutes box.
export async function confirmAskAction(_prev: Reply | null, f: FormData): Promise<Reply> {
  const { club, name } = await requireStaff("coach");
  const today = todayStr();
  let a: Action;
  try { a = JSON.parse(text(f, "action")) as Action; } catch { return { kind: "error", message: "That request could not be read. Ask again." }; }
  const athletes = await listAthletes(club);

  if (a.type === "draft") {
    await draftNextWeek();
    return { kind: "done", message: "Draft started." };
  }

  if (a.type === "minutes") {
    const mine = new Set(athletes.map((x) => x.code));
    const date = typeof a.date === "string" ? a.date : "";
    const rows = (Array.isArray(a.rows) ? a.rows : []).filter((r) => mine.has(r.code) && Number.isInteger(r.minutes) && r.minutes >= 0 && r.minutes <= 130);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || !rows.length) return { kind: "error", message: "Those minutes could not be saved. Ask again." };
    await saveMinutes(club, date, rows.map((r) => ({ code: r.code, name: athletes.find((x) => x.code === r.code)?.name ?? r.name, minutes: r.minutes })));
    await logEvent(club, { type: "minutes", athlete_code: null, athlete_name: null, text: `${name} saved match minutes for ${date} (asked in words)` });
    revalidatePath("/coach");
    return { kind: "done", message: `Saved minutes for ${rows.length} player${rows.length === 1 ? "" : "s"}.` };
  }

  if (a.type === "override") {
    const player = athletes.find((x) => x.code === a.code);
    if (!player) return { kind: "error", message: "That player is not in your squad." };
    const v = validateOverride(
      { exercise: a.exercise ?? "", swap_to: a.swap_to ?? "", max_sets: a.max_sets?.toString() ?? "", max_reps: a.max_reps?.toString() ?? "", load_pct: a.load_pct?.toString() ?? "", until: a.until ?? "", review_on: a.review_on ?? "", note: "" },
      await playerExerciseNames(player, today), today,
    );
    if (!v.ok) return { kind: "error", message: v.error };
    await createOverride(player.code, { ...v.value, created_by: name });
    after(async () => { await runAgentFor(player.code, today); });
    revalidatePath("/coach");
    revalidatePath(`/coach/athletes/${player.code}`);
    return { kind: "done", message: `Saved. ${player.name.split(" ")[0]} has this change from the next session with ${v.value.exercise}.` };
  }
  return { kind: "error", message: "That request could not be read. Ask again." };
}
