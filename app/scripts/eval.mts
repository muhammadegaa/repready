// Usage: npx tsx --env-file=.env.local scripts/eval.mts [S02 S07 ...]   (no ids = all scenarios)
// Needs OPENROUTER_API_KEY and OPENROUTER_MODEL. Prints the agent's proposal for each scenario.
// Scoring against the scientist's labels happens in the app (Evaluation tab); labels live in Firestore.
import { propose } from "../src/lib/agent/propose";
import { forModel } from "../src/lib/rules";
import { allRules } from "../src/lib/rules";
import { SCENARIOS } from "../src/lib/scenarios";

const only = new Set(process.argv.slice(2));
const rules = forModel(await allRules(process.env.EVAL_CLUB ?? "000000"));

for (const s of SCENARIOS) {
  if (only.size && !only.has(s.id)) continue;
  const { proposal, verdict, corrected } = await propose({ athlete: s.athlete, planned_session: s.planned_session, last_14_days: s.last_14_days }, rules);
  console.log(`\n${s.id} ${s.athlete.sport} | ${s.planned_session.label}${s.holdout ? " | held out" : ""}`);
  console.log(`  decision: ${proposal.decision}  rules: ${proposal.rules_applied.join(",") || "-"}${corrected ? "  (corrected after limits)" : ""}`);
  console.log(`  reason: ${proposal.reason}`);
  if (proposal.flag_to_coach) console.log(`  flag: ${proposal.flag_to_coach}`);
  console.log(`  accepted edits: ${JSON.stringify(verdict.accepted)}`);
  if (verdict.rejected.length) console.log(`  REJECTED by limits: ${JSON.stringify(verdict.rejected)}`);
}
