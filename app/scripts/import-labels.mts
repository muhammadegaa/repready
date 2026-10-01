// Usage: npx tsx scripts/import-labels.mts <labels-dir> [scenarios.json]
// Merges the cofounder's labels (exported from the labeling page's store, one <id>.json per scenario)
// into the expected block of each scenario.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Edit } from "../src/lib/agent/schema";

const labelsDir = process.argv[2];
if (!labelsDir) throw new Error("Usage: import-labels.mts <labels-dir> [scenarios.json]");
const scenariosPath = process.argv[3] ?? new URL("../../eval/scenarios.json", import.meta.url).pathname;

type Label = {
  decision: string;
  reason: string;
  rules_applied?: string[];
  edits: { exercise: string; sets?: number; reps?: number; load_pct?: number; swap_to?: string }[];
};

function toEdits(l: Label): Edit[] {
  const out: Edit[] = [];
  for (const e of l.edits) {
    if (e.sets != null) out.push({ kind: "set_sets", exercise: e.exercise, to: e.sets });
    if (e.reps != null) out.push({ kind: "set_reps", exercise: e.exercise, to: e.reps });
    if (e.load_pct != null) out.push({ kind: "set_load_pct", exercise: e.exercise, to_pct_of_planned: e.load_pct });
    if (e.swap_to) out.push({ kind: "swap", exercise: e.exercise, to_exercise: e.swap_to });
  }
  return out;
}

const file = JSON.parse(readFileSync(scenariosPath, "utf8"));
const byId = new Map<string, Label>();
for (const f of readdirSync(labelsDir).filter((n) => n.endsWith(".json"))) {
  byId.set(f.replace(/\.json$/, ""), JSON.parse(readFileSync(join(labelsDir, f), "utf8")));
}

let n = 0;
for (const s of file.scenarios) {
  const l = byId.get(s.id);
  if (!l?.decision) continue;
  s.expected = { decision: l.decision, edits: toEdits(l), reason: l.reason, rules_applied: l.rules_applied ?? [] };
  n++;
}
writeFileSync(scenariosPath, JSON.stringify(file, null, 2));
console.log(`Imported ${n} of ${file.scenarios.length} labels into ${scenariosPath}`);
