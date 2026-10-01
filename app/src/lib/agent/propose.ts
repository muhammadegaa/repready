import { z } from "zod";
import { enforceLimits, type LimitContext, type Verdict } from "./limits";
import { Proposal, type Exercise } from "./schema";

const SYSTEM = `You help a strength and conditioning coach adjust one planned session for one athlete, using the athlete's recent check-ins.

Always answer by calling submit_proposal. Do not reply with plain text.

Rules:
- Use only the rules in the rule set you are given. Name the rule ids you applied. If no rule applies, the decision is "none" with no edits.
- You only propose. The coach approves every change.
- Never raise sets, reps or load above the plan. Never cut volume or load by more than 25%.
- Express load changes as set_load_pct with to_pct_of_planned (100 is the plan).
- Pain, injury or illness notes: do not edit exercises. Use decision "flag_only" or "rest" and put the message for the coach in flag_to_coach.
- Write the reason in one plain sentence that cites the inputs. No medical advice, diagnosis or claims about preventing injury.`;

export type Scenario = {
  athlete: Record<string, unknown>;
  planned_session: { label: string; week_type: string; exercises: Exercise[] };
  last_14_days: unknown[];
};

export type Result = { proposal: Proposal; verdict: Verdict };

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to app/.env.local.`);
  return v;
}

export async function propose(
  scenario: Scenario,
  rules: unknown,
  ctx: LimitContext = { injuryFlaggedExercises: [], clearedExercises: [] },
): Promise<Result> {
  const base = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("OPENROUTER_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env("OPENROUTER_MODEL"),
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Rule set:\n${JSON.stringify(rules)}\n\nAthlete and planned session:\n${JSON.stringify({
            athlete: scenario.athlete,
            planned_session: scenario.planned_session,
          })}\n\nLast 14 days (day 0 is today):\n${JSON.stringify(scenario.last_14_days)}`,
        },
      ],
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
  const proposal = Proposal.parse(parsed);
  return { proposal, verdict: enforceLimits(scenario.planned_session.exercises, proposal, ctx) };
}
