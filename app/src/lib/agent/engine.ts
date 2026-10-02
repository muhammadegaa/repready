import { enforceLimits, type LimitContext, type Verdict } from "./limits";
import type { Edit, Exercise, Proposal } from "./schema";
import type { Scenario } from "./propose";

type Day = {
  day: number;
  sleep_h?: number | null;
  stress?: number | null;
  soreness?: { overall?: number | null } | null;
  session?: { completed?: boolean; rpe_delta?: number | null } | null;
  note?: string | null;
  availability?: "full" | "limited" | "out" | null;
};

const ILLNESS = /\b(fever|feverish|flu|covid|cough\w*|chest|sick|ill|vomit\w*|nausea|sore throat|felt hot)\b/i;
const PAIN = /\b(pain\w*|injur\w*|sharp|spasm\w*|twinge|pulled|strain\w*|sprain\w*|tweak\w*|swollen|swelling|clicking|locked)\b/i;

export type Finding = { rule: string; why: string };

// Which rules fire, from the numbers alone. Rules the scientist deleted are skipped.
export function evaluate(s: Scenario, active: Set<string>): Finding[] {
  const days = (s.last_14_days as Day[]).slice().sort((a, b) => a.day - b.day);
  const today = days.find((d) => d.day === 0);
  const on = (id: string, why: string, out: Finding[]) => active.has(id) && out.push({ rule: id, why });
  const out: Finding[] = [];

  // Notes from the last four days: an injury reported after the weekend match still matters on Tuesday, and a false alarm only costs the coach a glance.
  const note = days.filter((d) => d.day >= -3).map((d) => d.note ?? "").join(" ");
  if (note && ILLNESS.test(note)) on("R6", "Note mentions illness symptoms.", out);
  if (note && PAIN.test(note)) on("R7", "Note mentions pain or an injury.", out);
  if (out.length) return out; // illness or pain stops everything else: the coach decides.

  // The player's own statement about today. Not a scientist's rule, so it is always on, and it only ever raises a flag.
  if (today?.availability === "out") return [{ rule: "AV", why: "Player says they cannot train today." }];
  if (today?.availability === "limited") return [{ rule: "AV", why: "Player says they can only train in a limited way today." }];

  if (s.planned_session.week_type === "deload") {
    on("R10", "Planned session is in a deload week.", out);
    if (out.length) return out;
  }

  const sleeps = days.filter((d) => d.sleep_h != null).slice(-2);
  if (sleeps.length === 2 && sleeps.every((d) => d.sleep_h! < 6)) {
    on("R1", `Slept ${sleeps[0].sleep_h} h and ${sleeps[1].sleep_h} h on the last two nights.`, out);
  }

  const deltas = days.filter((d) => d.session?.completed && d.session.rpe_delta != null).slice(-4).map((d) => d.session!.rpe_delta!);
  const over = deltas.filter((x) => x >= 2).length;
  const under = deltas.filter((x) => x <= -2).length;
  if (over >= 3) on("R2", `Effort ran 2 or more above target in ${over} of the last ${deltas.length} sessions.`, out);

  const sore = today?.soreness?.overall;
  if (sore != null && sore >= 7) on("R3", `Soreness reported at ${sore}/10.`, out);

  if ((today?.stress ?? 0) >= 8 && today?.sleep_h != null && today.sleep_h < 6.5) {
    on("R4", `Stress ${today.stress}/10 with ${today.sleep_h} h sleep.`, out);
  }

  const recent = days.filter((d) => d.day >= -6);
  const earlier = days.filter((d) => d.day < -6);
  if (!recent.some((d) => d.session?.completed) && earlier.some((d) => d.session?.completed)) {
    on("R5", "No completed sessions in the last 7 days.", out);
  }

  if (!out.length && under >= 3) on("R9", `Effort ran 2 or more below target in ${under} of the last ${deltas.length} sessions.`, out);
  return out;
}

// A volume cut of about 15% for one exercise, always inside the 25% limit.
function trim(e: Exercise): Edit {
  if (e.sets >= 4) return { kind: "set_sets", exercise: e.name, to: e.sets - 1 };
  if (e.reps >= 5) return { kind: "set_reps", exercise: e.name, to: e.reps - 1 };
  return { kind: "set_load_pct", exercise: e.name, to_pct_of_planned: 90 };
}

const NOTE_FLAG: Record<string, string> = {
  R6: "Illness symptoms in the note. Proposing rest; the coach decides.",
  R7: "Pain or injury in the note. No automatic edit; clear the athlete before they train.",
};

export type Result = { proposal: Proposal; verdict: Verdict; corrected: boolean };

// Rules decide. No model is involved: a quiet morning costs nothing and a model outage cannot stop the morning.
export function decide(s: Scenario, active: Set<string>, ctx: LimitContext = { injuryFlaggedExercises: [], clearedExercises: [] }): Result {
  const findings = evaluate(s, active);
  const planned = s.planned_session.exercises;
  const ids = findings.map((f) => f.rule);
  const reason = findings.map((f) => f.why).join(" ");
  const done = (proposal: Proposal): Result => ({ proposal, verdict: enforceLimits(planned, proposal, ctx), corrected: false });

  if (!findings.length) return done({ decision: "none", edits: [], reason: "No rule fired.", rules_applied: [] });
  if (ids.includes("R6")) return done({ decision: "rest", edits: [], reason, rules_applied: ids, flag_to_coach: NOTE_FLAG.R6 });
  if (ids.includes("AV")) return done({ decision: "flag_only", edits: [], reason, rules_applied: ids, flag_to_coach: "The player reported their own availability. Decide what they do today; no edit is proposed." });
  if (ids.includes("R7")) return done({ decision: "flag_only", edits: [], reason, rules_applied: ids, flag_to_coach: NOTE_FLAG.R7 });
  if (ids.includes("R10")) return done({ decision: "none", edits: [], reason, rules_applied: ids });
  if (ids.length === 1 && ids[0] === "R9") {
    return done({ decision: "increase", edits: [], reason, rules_applied: ids, flag_to_coach: "Plan is consistently easy for this athlete. Consider progressing load within your limits; the agent cannot go above the plan." });
  }

  const protectedNames = new Set(ctx.injuryFlaggedExercises.map((n) => n.trim().toLowerCase()));
  const editable = planned.filter((e) => !protectedNames.has(e.name.trim().toLowerCase()));
  // R3 trims only the main lift (soreness is not recorded by region yet); other rules trim every exercise.
  const targets = ids.includes("R3") && ids.length === 1 ? editable.slice(0, 1) : editable;
  const flags: string[] = [];
  if (ids.includes("R3")) flags.push("Soreness is not recorded by region, so only the main lift was trimmed.");
  if (ids.includes("R4")) flags.push("High stress with poor sleep. Worth a conversation.");
  if (ids.includes("R5")) flags.push("Returning after a week without sessions. Check re-entry volume.");
  return done({
    decision: "reduce",
    edits: targets.map(trim),
    reason,
    rules_applied: ids,
    flag_to_coach: flags.join(" ") || null,
  });
}
