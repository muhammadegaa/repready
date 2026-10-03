import { z } from "zod";

// One small client for asking a language model to return structured data. It never sees player data: it is used only to read a coach's
// own program text. Failures are named so the screen can say something useful and offer the manual way instead.
export class ModelUnavailable extends Error {
  constructor(readonly reason: "not_configured" | "failed" | "bad_output", message: string) {
    super(message);
  }
}

export type AskOpts<T> = { system: string; user: string; tool: string; description: string; schema: z.ZodType<T> };
export type Ask = <T>(opts: AskOpts<T>) => Promise<T>;

const TIMEOUT_MS = 50_000;
const MAX_TOKENS = 4_000;

async function once(o: AskOpts<unknown>, extra: string, f: typeof fetch): Promise<unknown> {
  const key = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!key || !model) throw new ModelUnavailable("not_configured", "The reading assistant is not set up on this server.");
  const base = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  let res: Response;
  try {
    res = await f(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [{ role: "system", content: o.system }, { role: "user", content: o.user + extra }],
        tools: [{ type: "function", function: { name: o.tool, description: o.description, parameters: z.toJSONSchema(o.schema) } }],
        tool_choice: { type: "function", function: { name: o.tool } },
      }),
    });
  } catch (e) {
    throw new ModelUnavailable("failed", (e as Error).name === "TimeoutError" ? "The assistant took too long to answer." : "The assistant could not be reached.");
  }
  if (!res.ok) {
    console.error(`[model] ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    throw new ModelUnavailable("failed", res.status === 402 || res.status === 429 ? "The assistant is out of capacity right now." : "The assistant could not answer.");
  }
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[] } | null;
  const args = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new ModelUnavailable("bad_output", "The assistant did not return a structured answer.");
  try {
    return JSON.parse(args);
  } catch {
    throw new ModelUnavailable("bad_output", "The assistant's answer was cut off.");
  }
}

// Asks once; if the answer does not fit the schema, asks once more with what was wrong. Never returns unchecked data.
export function makeAsk(f: typeof fetch = fetch): Ask {
  return async function ask<T>(opts: AskOpts<T>): Promise<T> {
    let problem = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await once(opts, problem, f);
      const parsed = opts.schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      problem = `\n\nYour previous answer was rejected: ${parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "answer"}: ${i.message}`).join("; ")}. Answer again, fixing exactly that.`;
    }
    throw new ModelUnavailable("bad_output", "The assistant's answer did not fit the expected shape.");
  };
}

export const ask: Ask = (opts) => makeAsk()(opts);
