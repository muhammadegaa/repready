import { createHash } from "node:crypto";
import bundled from "./agent/rules.json";
import { listRuleOverrides, type RuleRow } from "./store";

export type Rule = {
  id: string;
  name: string;
  trigger: string;
  action: string;
  evidence: string;
  keep: RuleRow["keep"];
  updated_at: string | null;
  updated_by: string | null;
};

const base: Rule[] = bundled.rules.map((r) => ({
  id: r.id,
  name: r.name,
  trigger: r.trigger,
  action: r.action,
  evidence: r.evidence ?? "",
  keep: null,
  updated_at: null,
  updated_by: null,
}));

// Every rule, with the scientist's saved edits replacing the bundled text.
export async function allRules(): Promise<Rule[]> {
  const saved = new Map((await listRuleOverrides()).map((r) => [r.id, r]));
  return base.map((r) => saved.get(r.id) ?? r);
}

export const activeRules = (rules: Rule[]) => rules.filter((r) => r.keep !== "delete");

// What the model is shown: no evidence text or bookkeeping.
export const forModel = (rules: Rule[]) => activeRules(rules).map((r) => ({ id: r.id, name: r.name, trigger: r.trigger, action: r.action }));

export const rulesHash = (rules: Rule[]) =>
  createHash("sha256").update(JSON.stringify(forModel(rules))).digest("hex").slice(0, 12);

export const ruleById = (rules: Rule[], id: string) => rules.find((r) => r.id === id);
