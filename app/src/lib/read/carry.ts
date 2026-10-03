import { matchDayTag } from "../fixtures";
import type { Exercise } from "../agent/schema";
import { addDays, type ProgramDraft } from "./program";

type Src = { on_date: string; label: string; week_type: string; group: string | null; exercises: Exercise[]; sample?: boolean };

// The Monday strictly after `today`: the week a coach is planning ahead.
export function nextMonday(today: string): string {
  const d = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, ((8 - d) % 7) || 7);
}

// Next week starts as a copy of the week before it, which the coach then corrects. No model is involved, so nothing leaves the server.
export function carryForward(sessions: Src[], targetStart: string, fixtures: string[]): ProgramDraft | null {
  const from = addDays(targetStart, -7), to = addDays(targetStart, -1);
  const source = sessions.filter((s) => !s.sample && s.on_date >= from && s.on_date <= to);
  if (source.length === 0) return null;
  const copied = source
    .map((s) => ({ day: null, date: addDays(s.on_date, 7), label: s.label, week_type: s.week_type === "deload" ? ("deload" as const) : ("normal" as const), group: s.group, exercises: s.exercises.map((e) => ({ ...e, target_rpe: e.target_rpe ?? null })), how: "written" as const }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.group ?? "").localeCompare(b.group ?? ""));
  const notes = [`Copied from the week of ${from}. Say what is different this week, for example "make Friday a deload" or "Reserves train Tuesday too".`];
  const near = copied.map((s) => ({ s, tag: matchDayTag(s.date, fixtures) })).filter((x) => x.tag);
  const matches = fixtures.filter((f) => f >= targetStart && f <= addDays(targetStart, 6));
  if (matches.length) notes.push(`Match${matches.length > 1 ? "es" : ""} this week: ${matches.join(", ")}. ${near.length ? `Sessions near ${matches.length > 1 ? "them" : "it"}: ${[...new Set(near.map((x) => `${x.s.date} ${x.s.label}${x.s.group ? ` (${x.s.group})` : ""} is ${x.tag}`))].join("; ")}.` : "No session falls within three days of it."}`);
  else notes.push("No match is in your fixtures for this week. Add fixtures, or link your calendar, if one is coming.");
  return { week_start: targetStart, sessions: copied, notes };
}
