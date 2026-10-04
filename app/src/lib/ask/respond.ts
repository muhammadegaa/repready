import { describeEdit } from "../agent/apply";
import { describeOverride, validateOverride } from "../overrides";
import { readMinutes } from "../minutes";
import { firstName } from "../squad";
import type { Understood } from "./understand";

// Everything the coach sees in reply is built here from stored data, in plain code. The model's output is only used to pick which
// of these runs and to fill in its inputs, and every input is checked again before anything is saved.
export type Person = {
  code: string;
  name: string;
  status: string; // a key of STATUS in views.ts
  statusLabel: string;
  proposal: { id: string; decision: string | null; reason: string | null; rules: string[]; flag: string | null; edits: Parameters<typeof describeEdit>[0][]; status: string } | null;
  exercises: string[]; // exercises in this player's coming sessions
};

export type Action =
  | { type: "override"; code: string; exercise: string; swap_to: string | null; max_sets: number | null; max_reps: number | null; load_pct: number | null; until: string | null; review_on: string | null }
  | { type: "minutes"; date: string; rows: { code: string; name: string; minutes: number }[] }
  | { type: "draft" };

export type Reply =
  | { kind: "answer"; title: string; lines: string[]; reminders?: { code: string; name: string; message: string }[]; links?: { label: string; href: string }[] }
  | { kind: "confirm"; title: string; lines: string[]; action: Action }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();

// One player, or why not. A name that fits two players is never guessed.
export function findPlayer(said: string | null, people: Person[]): { person: Person } | { error: string } {
  const who = norm(said ?? "");
  if (!who) return { error: "Which player? Say their name." };
  const parts = (p: Person) => norm(p.name).split(" ");
  const tries: ((p: Person) => boolean)[] = [
    (p) => norm(p.name) === who,
    (p) => parts(p).at(-1) === who,
    (p) => who.includes(" ") && parts(p).at(-1) === who.split(" ").at(-1) && (parts(p)[0] === who.split(" ")[0] || parts(p)[0][0] === who[0]),
    (p) => parts(p)[0] === who,
  ];
  for (const t of tries) {
    const hit = people.filter(t);
    if (hit.length === 1) return { person: hit[0] };
    if (hit.length > 1) return { error: `More than one player fits "${said}": ${hit.map((h) => h.name).join(", ")}. Use the full name.` };
  }
  return { error: `I could not find a player called "${said}" in your squad.` };
}

export function needsMe(people: Person[]): Reply {
  const pending = people.filter((p) => p.proposal?.status === "pending");
  const flagged = pending.filter((p) => p.proposal?.flag);
  if (!pending.length) return { kind: "answer", title: "Nothing is waiting for you", lines: [people.some((p) => p.status === "waiting") ? "Some players have not checked in yet." : "Everyone who has checked in is on plan or already decided."] };
  const line = (p: Person) => `${p.name}: ${p.proposal?.flag ?? p.proposal?.reason ?? "proposal waiting"}`;
  return {
    kind: "answer",
    title: `${pending.length} waiting for you`,
    lines: [...flagged.map(line), ...pending.filter((p) => !p.proposal?.flag).map(line)].map((l) => l.slice(0, 220)),
    links: [{ label: "Open Today", href: "/coach" }],
  };
}

export function whyFlagged(said: string | null, people: Person[]): Reply {
  const f = findPlayer(said, people);
  if ("error" in f) return { kind: "error", message: f.error };
  const { person: p } = f;
  const pr = p.proposal;
  if (!pr) return { kind: "answer", title: p.name, lines: [p.status === "waiting" ? `${firstName(p.name)} has not checked in today, so nothing has been proposed.` : `Nothing has been proposed for ${firstName(p.name)} today.`] };
  const lines = [pr.reason ?? "No reason recorded.", ...(pr.rules.length ? [`Rule${pr.rules.length > 1 ? "s" : ""}: ${pr.rules.join(", ")}`] : []), ...pr.edits.map(describeEdit), ...(pr.flag ? [`Flag to you: ${pr.flag}`] : [])];
  return { kind: "answer", title: `${p.name}: ${pr.status === "no_change" ? "no change proposed" : pr.status}`, lines, links: [{ label: `Open ${firstName(p.name)}`, href: `/coach/athletes/${p.code}` }] };
}

export function notIn(people: Person[]): Reply {
  const out = people.filter((p) => p.status === "waiting");
  if (!out.length) return { kind: "answer", title: "Everyone has answered", lines: ["Nobody with a session today is waiting to check in."] };
  return {
    kind: "answer",
    title: `${out.length} not checked in`,
    lines: out.map((p) => p.name),
    reminders: out.map((p) => ({ code: p.code, name: p.name, message: `Morning ${firstName(p.name)}, please do your RepReady check-in before training: {url}` })),
  };
}

const isoDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

export function minutesPreview(u: Understood, people: Person[], today: string): Reply {
  if (!u.date) return { kind: "error", message: 'Which match? Say the day, for example "yesterday" or "Saturday".' };
  if (!isoDay(u.date) || u.date > today) return { kind: "error", message: "The match day cannot be in the future." };
  if (!u.minutes?.length) return { kind: "error", message: 'Say who played and for how long, for example "Mensah 90, Ortiz 60".' };
  const { rows, unmatched } = readMinutes(u.minutes.map((m) => `${m.player} ${m.minutes}`).join("\n"), people.map((p) => ({ code: p.code, name: p.name })));
  if (!rows.length) return { kind: "error", message: "I could not match any of those names to your squad." };
  return {
    kind: "confirm",
    title: `Save match minutes for ${u.date}`,
    lines: [...rows.map((r) => `${r.name}: ${r.minutes} min`), ...(unmatched.length ? [`Not matched, left out: ${unmatched.join(", ")}`] : [])],
    action: { type: "minutes", date: u.date, rows },
  };
}

export function overridePreview(u: Understood, people: Person[], today: string): Reply {
  const f = findPlayer(u.player, people);
  if ("error" in f) return { kind: "error", message: f.error };
  const { person: p } = f;
  const input = {
    exercise: u.exercise ?? "", swap_to: u.swap_to ?? "", max_sets: u.max_sets?.toString() ?? "", max_reps: u.max_reps?.toString() ?? "",
    load_pct: u.load_pct?.toString() ?? "", until: u.until ?? "", review_on: u.review_on ?? "", note: "",
  };
  const v = validateOverride(input, p.exercises, today);
  if (!v.ok) return { kind: "error", message: v.error };
  const o = v.value;
  return {
    kind: "confirm",
    title: `Change ${firstName(p.name)}'s plan`,
    lines: [describeOverride(o), o.until ? `Until ${o.until}.` : "Until you lift it.", o.review_on ? `Today reminds you on ${o.review_on}.` : "No review date set."],
    action: { type: "override", code: p.code, exercise: o.exercise, swap_to: o.swap_to, max_sets: o.max_sets, max_reps: o.max_reps, load_pct: o.load_pct, until: o.until, review_on: o.review_on },
  };
}

export function draftPreview(): Reply {
  return { kind: "confirm", title: "Draft next week", lines: ["Copies this week's sessions a week on, notes the matches, and opens the draft for you to correct. Nothing goes live until you use it."], action: { type: "draft" } };
}

// What the model's reading turns into. Anything it could not place is said plainly.
export function respond(u: Understood, people: Person[], today: string): Reply {
  switch (u.intent) {
    case "needs_me": return needsMe(people);
    case "why_flagged": return whyFlagged(u.player, people);
    case "not_in": return notIn(people);
    case "log_minutes": return minutesPreview(u, people, today);
    case "standing_change": return overridePreview(u, people, today);
    case "draft_next_week": return draftPreview();
    default: return { kind: "error", message: "I could not tell what you want. I can say who needs you or who has not answered, explain a flag, save match minutes, change one player's plan for an exercise, or draft next week." };
  }
}
