import { applyEdits } from "./agent/apply";
import type { Edit, Exercise } from "./agent/schema";

// A player override is the coach's own standing instruction for one player and one exercise, for example after an injury.
// It applies to every session that contains the exercise until the coach lifts it or its end date passes.
// It is stored as the instruction (caps and a swap), not as edits, so it fits any session: a cap never raises a lighter session.
export type Override = {
  id: string;
  athlete_code: string;
  exercise: string; // as named in the program
  swap_to: string | null;
  max_sets: number | null; // cap
  max_reps: number | null; // cap
  load_pct: number | null; // 50 to 99, percent of the planned load
  until: string | null; // last day it applies, YYYY-MM-DD
  review_on: string | null; // day Today reminds the coach to look at it again
  note: string; // private to staff
  created_at: string;
  created_by: string;
  lifted_at: string | null;
};

export const OVERRIDE_LIMITS = { loadMin: 50, loadMax: 99, nameMax: 60, noteMax: 200 };
const norm = (s: string) => s.trim().toLowerCase();

export function isActive(o: Pick<Override, "until" | "lifted_at">, date: string): boolean {
  return o.lifted_at === null && (o.until === null || o.until >= date);
}

// The edits one override makes to one session. Only changes that actually reduce something are emitted.
export function overrideEdits(o: Override, exercises: Exercise[]): Edit[] {
  const e = exercises.find((x) => norm(x.name) === norm(o.exercise));
  if (!e) return [];
  const out: Edit[] = [];
  if (o.max_sets !== null && o.max_sets < e.sets) out.push({ kind: "set_sets", exercise: e.name, to: o.max_sets });
  if (o.max_reps !== null && o.max_reps < e.reps) out.push({ kind: "set_reps", exercise: e.name, to: o.max_reps });
  if (o.load_pct !== null && o.load_pct < 100) out.push({ kind: "set_load_pct", exercise: e.name, to_pct_of_planned: o.load_pct });
  if (o.swap_to) out.push({ kind: "swap", exercise: e.name, to_exercise: o.swap_to });
  return out;
}

export type ResolvedPlan = {
  exercises: Exercise[]; // the plan this player actually has, before the rules propose anything
  changed: Map<string, string>; // exercise name as shown -> short description for the player and coach
  applied: Override[];
};

// The player's plan after their active overrides. If two overrides name the same exercise, the newer one wins.
export function resolvePlan(exercises: Exercise[], overrides: Override[], date: string): ResolvedPlan {
  const live = overrides.filter((o) => isActive(o, date)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const newest = new Map<string, Override>();
  for (const o of live) newest.set(norm(o.exercise), o);
  const applied = [...newest.values()];
  const edits = applied.flatMap((o) => overrideEdits(o, exercises));
  const shown = applyEdits(exercises, edits);
  const changed = new Map<string, string>();
  for (const s of shown) if (s.note) changed.set(s.name, s.note.replace(/^Adjusted: /, ""));
  const plain = shown.map((x): Exercise => ({ name: x.name, sets: x.sets, reps: x.reps, load: x.load, target_rpe: x.target_rpe }));
  return { exercises: plain, changed, applied };
}

export type OverrideInput = {
  exercise: string; swap_to: string; max_sets: string; max_reps: string; load_pct: string; until: string; review_on: string; note: string;
};

// Checks what the coach typed. Returns the cleaned override fields or a plain message.
export function validateOverride(
  i: OverrideInput, knownExercises: string[], today: string,
): { ok: true; value: Pick<Override, "exercise" | "swap_to" | "max_sets" | "max_reps" | "load_pct" | "until" | "review_on" | "note"> } | { ok: false; error: string } {
  const known = knownExercises.find((n) => norm(n) === norm(i.exercise));
  if (!known) return { ok: false, error: "Choose one of the player's exercises." };
  const whole = (v: string, label: string): number | null | string => {
    const t = v.trim();
    if (t === "") return null;
    if (!/^\d{1,2}$/.test(t) || Number(t) < 1) return `${label} must be a whole number of at least 1.`;
    return Number(t);
  };
  const sets = whole(i.max_sets, "Max sets"), reps = whole(i.max_reps, "Max reps");
  if (typeof sets === "string") return { ok: false, error: sets };
  if (typeof reps === "string") return { ok: false, error: reps };
  let load: number | null = null;
  if (i.load_pct.trim() !== "") {
    load = Number(i.load_pct);
    if (!Number.isInteger(load) || load < OVERRIDE_LIMITS.loadMin || load > OVERRIDE_LIMITS.loadMax) return { ok: false, error: `Load must be a whole number from ${OVERRIDE_LIMITS.loadMin} to ${OVERRIDE_LIMITS.loadMax} percent of the planned load.` };
  }
  const swap = i.swap_to.trim().replace(/\s+/g, " ");
  if (swap.length > OVERRIDE_LIMITS.nameMax) return { ok: false, error: "The swap name is too long." };
  if (sets === null && reps === null && load === null && !swap) return { ok: false, error: "Enter at least one change: a swap, a cap on sets or reps, or a lower load." };
  const day = (v: string): string | null | undefined => {
    const t = v.trim();
    if (t === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) return undefined;
    return t;
  };
  const until = day(i.until), review = day(i.review_on);
  if (until === undefined) return { ok: false, error: "The end date is not a date." };
  if (review === undefined) return { ok: false, error: "The review date is not a date." };
  if (until !== null && until < today) return { ok: false, error: "The end date is in the past." };
  if (review !== null && review < today) return { ok: false, error: "The review date is in the past." };
  if (until !== null && review !== null && review > until) return { ok: false, error: "The review date is after the end date." };
  const note = i.note.trim().slice(0, OVERRIDE_LIMITS.noteMax);
  return { ok: true, value: { exercise: known, swap_to: swap || null, max_sets: sets, max_reps: reps, load_pct: load, until, review_on: review, note } };
}

// One line for lists: "Back squat: swap to Box squat, max 3 sets, 80% of planned load".
export function describeOverride(o: Pick<Override, "exercise" | "swap_to" | "max_sets" | "max_reps" | "load_pct">): string {
  const parts = [
    o.swap_to ? `swap to ${o.swap_to}` : null,
    o.max_sets !== null ? `max ${o.max_sets} sets` : null,
    o.max_reps !== null ? `max ${o.max_reps} reps` : null,
    o.load_pct !== null ? `${o.load_pct}% of planned load` : null,
  ].filter(Boolean);
  return `${o.exercise}: ${parts.join(", ")}`;
}
