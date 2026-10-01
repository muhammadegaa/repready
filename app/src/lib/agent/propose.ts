import { z } from "zod";
import { enforceLimits, type LimitContext, type Verdict } from "./limits";
import { Proposal, type Exercise } from "./schema";

const SYSTEM = `You help a strength and conditioning coach adjust one planned session for one athlete, using the athlete's recent check-ins.

Always answer by calling submit_proposal. Do not reply with plain text.

Rules:
- Use only the rules in the rule set you are given. Name the rule ids you applied. If no rule applies, the decision is "none" with no edits.
- You only propose. The coach approves every change.
- Never raise sets, reps or load above the plan. Never cut volume or load by more than 25%.
- Volume is sets x reps. Check each exercise before you propose: dropping 1 set from 4 is exactly 25% and allowed; dropping 1 set from 3 is 33% and NOT allowed (cut reps by 1 or load by up to 25% instead); dropping 1 rep from 5 is 20% and allowed.
- Express load changes as set_load_pct with to_pct_of_planned (100 is the plan).
- Pain, injury or illness notes: do not edit exercises. Use decision "flag_only" or "rest" and put the message for the coach in flag_to_coach.
- reason: one sentence of at most 25 words. Name the inputs (for example sleep hours, RPE vs target) and the change. Do not use the word "I" and do not describe your own process. No medical advice, diagnosis or claims about preventing injury.
- flag_to_coach: set it only when the coach must check or decide something the edits do not cover. At most two sentences. Leave it out otherwise, and never use it to explain the reason again.
- If wearable is set, sleep_h is measured by that device. reported_sleep_h is what the athlete typed. hrv_ms and resting_hr are context. Still apply only rules from the rule set.`;

export type Scenario = {
  athlete: Record<string, unknown>;
  planned_session: { label: string; week_type: string; exercises: Exercise[] };
  last_14_days: unknown[];
};

export type Result = { proposal: Proposal; verdict: Verdict; corrected: boolean };

type Message = { role: "system" | "user" | "assistant"; content: string };

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to app/.env.local.`);
  return v;
}

async function ask(messages: Message[]): Promise<Proposal> {
  const base = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("OPENROUTER_MODEL"),
      max_tokens: 4096,
      messages,
      tools: [
        {
          type: "function",
          function: {
            name: "submit_proposal",
            description: "Submit the proposed adjustment for the coach to review.",
            parameters: z.toJSONSchema(Proposal),
          },
        },
      ],
      tool_choice: "auto",
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const args = body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("model returned no tool call");
  let parsed: unknown;
  try {
    parsed = JSON.parse(args);
  } catch {
    throw new Error(`model returned malformed tool arguments (finish_reason: ${body.choices?.[0]?.finish_reason}, completion_tokens: ${body.usage?.completion_tokens})`);
  }
  return Proposal.parse(parsed);
}

export async function propose(
  scenario: Scenario,
  rules: unknown,
  ctx: LimitContext = { injuryFlaggedExercises: [], clearedExercises: [] },
): Promise<Result> {
  const messages: Message[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Rule set:\n${JSON.stringify(rules)}\n\nAthlete and planned session:\n${JSON.stringify({
        athlete: scenario.athlete,
        planned_session: scenario.planned_session,
      })}\n\nLast 14 days (day 0 is today):\n${JSON.stringify(scenario.last_14_days)}`,
    },
  ];
  const planned = scenario.planned_session.exercises;
  const first = await ask(messages);
  const firstVerdict = enforceLimits(planned, first, ctx);
  if (!firstVerdict.rejected.length || (first.decision !== "reduce" && first.decision !== "swap")) {
    return { proposal: first, verdict: firstVerdict, corrected: false };
  }

  // The hard limits removed some edits. Give the model the reasons once and let it propose again within them.
  const feedback = firstVerdict.rejected.map((r) => `${JSON.stringify(r.edit)}: ${r.why}`).join("\n");
  const second = await ask([
    ...messages,
    { role: "assistant", content: JSON.stringify(first) },
    { role: "user", content: `The hard limits rejected these edits:\n${feedback}\nPropose again so every edit is within the limits, keeping the same rule if it still applies.` },
  ]);
  const secondVerdict = enforceLimits(planned, second, ctx);
  const better = secondVerdict.rejected.length < firstVerdict.rejected.length || secondVerdict.accepted.length > firstVerdict.accepted.length;
  return better ? { proposal: second, verdict: secondVerdict, corrected: true } : { proposal: first, verdict: firstVerdict, corrected: false };
}
