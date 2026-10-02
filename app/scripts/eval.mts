// Usage: npx tsx --env-file=.env.local scripts/eval.mts [S02 S07 ...]   (no ids = all scenarios)
// Runs the rules engine (no model). Prints its proposal for each scenario.
// Scoring against the scientist's labels happens in the app (Evaluation tab); labels live in Firestore.
import { decide } from "../src/lib/agent/engine";
import { activeRules, allRules } from "../src/lib/rules";
import { SCENARIOS } from "../src/lib/scenarios";

const only = new Set(process.argv.slice(2));
const rules = new Set(activeRules(await allRules(process.env.EVAL_CLUB ?? "000000")).map((r) => r.id));

for (const s of SCENARIOS) {
  if (only.size && !only.has(s.id)) continue;
  const { proposal, verdict, corrected } = decide({ athlete: s.athlete, planned_session: s.planned_session, last_14_days: s.last_14_days }, rules);
  console.log(`\n${s.id} ${s.athlete.sport} | ${s.planned_session.label}${s.holdout ? " | held out" : ""}`);
  console.log(`  decision: ${proposal.decision}  rules: ${proposal.rules_applied.join(",") || "-"}${corrected ? "  (corrected after limits)" : ""}`);
  console.log(`  reason: ${proposal.reason}`);
  if (proposal.flag_to_coach) console.log(`  flag: ${proposal.flag_to_coach}`);
  console.log(`  accepted edits: ${JSON.stringify(verdict.accepted)}`);
  if (verdict.rejected.length) console.log(`  REJECTED by limits: ${JSON.stringify(verdict.rejected)}`);
}
