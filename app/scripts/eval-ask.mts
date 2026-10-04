// Usage: npx tsx --env-file=.env.local scripts/eval-ask.mts [substring of a phrase ...]
// Sends each phrase in src/lib/ask/phrases.ts to the real model (names replaced, as in the app) and scores what it made of it.
// Passes when intent accuracy is at least 90%, no phrase that should be "unclear" becomes an action, and no change names the wrong player.
import { ask } from "../src/lib/read/model";
import { EXERCISES, PHRASES, SQUAD, TODAY } from "../src/lib/ask/phrases";
import { understand } from "../src/lib/ask/understand";

const WRITES = new Set(["log_minutes", "standing_change", "draft_next_week"]);
const norm = (s: string | null) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim();
const sameName = (a: string | null, b: string | null) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };
const last = (s: string) => norm(s).split(" ").at(-1);

const only = process.argv.slice(2);
const phrases = PHRASES.filter((p) => !only.length || only.some((o) => p.say.includes(o)));
let intentOk = 0, paramN = 0, paramOk = 0, unsafe = 0, wrongPlayer = 0, failed = 0;
const rows: string[] = [];

for (const p of phrases) {
  let u;
  try { u = await understand(ask, { sentence: p.say, today: TODAY, names: SQUAD, exercises: EXERCISES }); }
  catch (e) { failed++; rows.push(`ERROR  ${p.say}  (${(e as Error).message})`); continue; }
  const okIntent = u.intent === p.intent;
  if (okIntent) intentOk++;
  if (p.intent === "unclear" && WRITES.has(u.intent)) unsafe++;
  const bad: string[] = [];
  const e = p.expect;
  if (e && okIntent) {
    const check = (name: string, ok: boolean) => { paramN++; if (ok) paramOk++; else bad.push(name); };
    if (e.player !== undefined) { const ok = sameName(u.player, e.player); check("player", ok); if (!ok && p.intent === "standing_change") wrongPlayer++; }
    if (e.exercise !== undefined) check("exercise", norm(u.exercise) === norm(e.exercise));
    for (const k of ["max_sets", "max_reps", "load_pct", "until", "date"] as const) if (k in e) check(k, u[k] === (e[k] ?? null));
    if (e.swap_to !== undefined) check("swap_to", sameName(u.swap_to, e.swap_to));
    if (e.minutes) {
      const got = new Map((u.minutes ?? []).map((m) => [last(m.player), m.minutes]));
      check("minutes", e.minutes.length === got.size && e.minutes.every(([n, m]) => got.get(last(n)) === m));
    }
  }
  rows.push(`${okIntent && !bad.length ? "ok    " : "WRONG "} ${p.say}  →  ${u.intent}${bad.length ? `  (wrong: ${bad.join(", ")}; got ${JSON.stringify({ ...u, intent: undefined })})` : ""}${okIntent ? "" : `  (expected ${p.intent})`}`);
}

console.log(rows.join("\n"));
const n = phrases.length;
const acc = intentOk / n;
console.log(`\nIntent: ${intentOk}/${n} (${(acc * 100).toFixed(0)}%)  Parameters: ${paramOk}/${paramN}  Unclear that became an action: ${unsafe}  Wrong player on a change: ${wrongPlayer}  Model errors: ${failed}`);
const pass = acc >= 0.9 && unsafe === 0 && wrongPlayer === 0 && failed === 0;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
