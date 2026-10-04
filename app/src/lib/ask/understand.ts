import { z } from "zod";
import type { Ask } from "../read/model";
import { makeRedactor } from "../read/redact";

// The model's only job: turn a coach's sentence into one of a few named requests. It sees the sentence with player names replaced by
// codes, the date, and the names of exercises in the program. It never sees a check-in, a note or a proposal. What happens next is
// decided and checked by our own code, so a wrong reading shows up as a preview the coach can cancel.
export const INTENTS = ["needs_me", "why_flagged", "not_in", "log_minutes", "standing_change", "draft_next_week", "unclear"] as const;
export type Intent = (typeof INTENTS)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

export const Understood = z.object({
  intent: z.enum(INTENTS),
  player: z.string().max(80).nullable(),
  exercise: z.string().max(60).nullable(),
  max_sets: z.number().int().min(1).max(20).nullable(),
  max_reps: z.number().int().min(1).max(50).nullable(),
  load_pct: z.number().int().min(1).max(100).nullable(),
  swap_to: z.string().max(60).nullable(),
  until: day,
  review_on: day,
  date: day,
  minutes: z.array(z.object({ player: z.string().max(80), minutes: z.number().int().min(0).max(130) })).max(40).nullable(),
});
export type Understood = z.infer<typeof Understood>;

export const COMMANDS: { label: string; intent: "needs_me" | "not_in" | "draft_next_week" }[] = [
  { label: "Who needs me?", intent: "needs_me" },
  { label: "Who hasn't answered?", intent: "not_in" },
  { label: "Plan next week", intent: "draft_next_week" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function systemPrompt(today: string, exercises: string[]): string {
  const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()];
  return [
    "You read one sentence from a football strength and conditioning coach and name what they are asking for. You never answer the question yourself.",
    `Today is ${weekday} ${today}. Work out any date the coach gives ("yesterday", "until Friday", "next Tuesday") as YYYY-MM-DD from that.`,
    "Player names have been replaced by codes such as [N1]. Copy a code exactly as written into `player`. Never guess a name.",
    `Exercises in the program: ${exercises.length ? exercises.join("; ") : "none yet"}. Put the exercise the coach means in \`exercise\`, spelled exactly as in this list. If none matches, leave it null.`,
    "Intents:",
    "- needs_me: who needs my decision, who is flagged, what is waiting for me.",
    "- why_flagged: why a named player was flagged or given a proposal. Set `player`.",
    "- not_in: who has not checked in or answered, or chase players. ",
    "- log_minutes: the coach says who played and for how long. Set `date` (the match day) and `minutes`, one entry per player with whole minutes (0 if they did not play). Set `date` null if the coach gave no day.",
    "- standing_change: the coach wants one player to do less or something different on one exercise for a while. Set `player`, `exercise`, and only what they asked for: `max_sets`, `max_reps`, `load_pct` (percent of planned load, for example 80), `swap_to` (name of the replacement exercise). Set `until` if they gave an end date and `review_on` if they said when to look at it again. Never raise a number above the plan.",
    "- draft_next_week: start next week's program from this week.",
    "- unclear: anything else, a greeting, a medical question, a request to change rules or autonomy, or a sentence you cannot place. When unsure, choose unclear.",
    "Set every field you do not need to null.",
  ].join("\n");
}

export type UnderstandInput = { sentence: string; today: string; names: string[]; exercises: string[] };

// Asks the model. Player names are replaced before the call and put back in the answer.
export async function understand(askModel: Ask, i: UnderstandInput): Promise<Understood> {
  const r = makeRedactor(i.names);
  const out = await askModel({
    system: systemPrompt(i.today, i.exercises),
    user: r.redact(i.sentence.slice(0, 500)),
    tool: "name_request",
    description: "Name what the coach is asking for and fill in only the fields it needs.",
    schema: Understood,
  });
  return r.restore(out);
}
