// Usage: npx tsx --env-file=.env.local scripts/eval.mts [S02 S07 ...]   (no ids = all scenarios)
// Needs OPENROUTER_API_KEY and OPENROUTER_MODEL in app/.env.local.
// Scores an agent proposal against the cofounder's label once expected.decision is filled in.
import { readFileSync } from "node:fs";
import { propose } from "../src/lib/agent/propose";
import type { Edit, Exercise } from "../src/lib/agent/schema";

const dir = new URL("../../eval/", import.meta.url);
const rules = JSON.parse(readFileSync(new URL("rules.json", dir), "utf8"));
const { scenarios } = JSON.parse(readFileSync(new URL("scenarios.json", dir), "utf8"));
const only = new Set(process.argv.slice(2));

type Expected = { decision: string | null; edits: Edit[] };

// Volume (sets x reps) and load as a fraction of the plan, per exercise, after applying edits.
function factors(edits: Edit[], planned: Exercise[]) {
  const out = new Map<string, { volume: number; load: number }>();
  for (const p of planned) {
    const mine = edits.filter((e) => e.exercise.toLowerCase() === p.name.toLowerCase());
    if (!mine.length) continue;
    let sets = p.sets, reps = p.reps, load = 100;
    for (const e of mine) {
      if (e.kind === "set_sets") sets = e.to;
      if (e.kind === "set_reps") reps = e.to;
      if (e.kind === "set_load_pct") load = e.to_pct_of_planned;
    }
    out.set(p.name.toLowerCase(), { volume: (sets * reps) / (p.sets * p.reps) * 100, load });
  }
  return out;
}

function agrees(expected: Expected, actualDecision: string, actualEdits: Edit[], planned: Exercise[]) {
  if (expected.decision !== actualDecision) return false;
  const a = factors(actualEdits, planned);
  const e = factors(expected.edits, planned);
  if (a.size !== e.size) return false;
  for (const [name, ef] of e) {
    const af = a.get(name);
    if (!af || Math.abs(af.volume - ef.volume) > 10 || Math.abs(af.load - ef.load) > 10) return false;
  }
  return true;
}

let scored = 0, agreed = 0;
for (const s of scenarios) {
  if (only.size && !only.has(s.id)) continue;
  const { proposal, verdict } = await propose(s, rules);
  console.log(`\n${s.id} ${s.athlete.sport} | ${s.planned_session.label}`);
  console.log(`  decision: ${proposal.decision}  rules: ${proposal.rules_applied.join(",") || "-"}`);
  console.log(`  reason: ${proposal.reason}`);
  if (proposal.flag_to_coach) console.log(`  flag: ${proposal.flag_to_coach}`);
  console.log(`  accepted edits: ${JSON.stringify(verdict.accepted)}`);
  if (verdict.rejected.length) console.log(`  REJECTED by limits: ${JSON.stringify(verdict.rejected)}`);
  if (!verdict.reasonOk) console.log("  REASON REJECTED: medical language");
  if (s.expected.decision) {
    scored++;
    const ok = agrees(s.expected, proposal.decision, verdict.accepted, s.planned_session.exercises);
    if (ok) agreed++;
    console.log(`  vs expert: ${ok ? "AGREE" : "DIFFER"} (expert: ${s.expected.decision})`);
  }
}
console.log(scored ? `\nAgreement: ${agreed}/${scored}` : "\nNo labels yet: outputs only, nothing scored.");
