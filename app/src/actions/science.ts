"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { propose } from "@/lib/agent/propose";
import { agrees, summarize } from "@/lib/agent/score";
import { AGENT_LIMITS, buildEdits } from "@/lib/edits";
import { activeRules, allRules, forModel, rulesHash } from "@/lib/rules";
import { scenarioById, SCENARIOS } from "@/lib/scenarios";
import { listLabels, saveEvalRun, saveLabel, saveRule, type EvalResult, type RuleRow } from "@/lib/store";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const DECISIONS = ["none", "reduce", "swap", "rest", "flag_only", "increase"];

export async function saveRuleAction(f: FormData) {
  await requireRole("scientist");
  const id = text(f, "id");
  const rules = await allRules();
  const current = rules.find((r) => r.id === id);
  if (!current) return;
  const keep = text(f, "keep");
  await saveRule(
    {
      id,
      name: current.name,
      trigger: text(f, "trigger").slice(0, 600),
      action: text(f, "action").slice(0, 600),
      evidence: text(f, "evidence").slice(0, 1000),
      keep: (["keep", "change", "delete"].includes(keep) ? keep : null) as RuleRow["keep"],
    },
    "scientist",
  );
  revalidatePath("/science");
}

export async function saveLabelAction(_prev: { error: string | null; saved?: boolean } | null, f: FormData): Promise<{ error: string | null; saved?: boolean }> {
  await requireRole("scientist");
  const id = text(f, "id");
  const s = scenarioById(id);
  const decision = text(f, "decision");
  const reason = text(f, "reason").slice(0, 400);
  if (!s || !DECISIONS.includes(decision)) return { error: "Choose a decision." };
  if (!reason) return { error: "Write a one-sentence reason." };
  let edits: ReturnType<typeof buildEdits>["edits"] = [];
  if (decision === "reduce" || decision === "swap") {
    const built = buildEdits((k) => text(f, k), s.planned_session.exercises, AGENT_LIMITS);
    if (built.error) return { error: built.error };
    edits = built.edits;
    if (decision === "reduce" && !edits.length) return { error: 'Reduce needs at least one edit. Choose "No change" if nothing should change.' };
    if (decision === "swap" && !edits.some((e) => e.kind === "swap")) return { error: "Swap needs at least one exercise to swap to." };
  }
  const rules = f.getAll("rule").map(String);
  await saveLabel({ id, decision, edits, reason, rules_applied: rules, labeled_at: new Date().toISOString() });
  revalidatePath("/science");
  return { error: null, saved: true };
}

export async function scenarioIds(): Promise<string[]> {
  await requireRole("scientist");
  return SCENARIOS.map((s) => s.id);
}

export async function runScenario(id: string): Promise<EvalResult> {
  await requireRole("scientist");
  const s = scenarioById(id);
  if (!s) throw new Error("Unknown scenario");
  const [rules, labels] = await Promise.all([allRules(), listLabels()]);
  const label = labels.find((l) => l.id === id) ?? null;
  const base = { id, expected: label?.decision ?? null, holdout: s.holdout };
  try {
    const { proposal, verdict } = await propose(
      { athlete: s.athlete, planned_session: s.planned_session, last_14_days: s.last_14_days },
      forModel(rules),
    );
    const agree = label ? agrees({ decision: label.decision, edits: label.edits }, { decision: proposal.decision, edits: verdict.accepted }, s.planned_session.exercises) : null;
    return { ...base, decision: proposal.decision, edits: verdict.accepted, reason: proposal.reason, error: null, agree };
  } catch (e) {
    return { ...base, decision: null, edits: [], reason: null, error: (e as Error).message, agree: label ? false : null };
  }
}

export async function finishEvalRun(results: EvalResult[]): Promise<void> {
  await requireRole("scientist");
  const rules = await allRules();
  const summary = summarize(results);
  await saveEvalRun({
    at: new Date().toISOString(),
    model: process.env.OPENROUTER_MODEL ?? "unknown",
    rules_hash: rulesHash(activeRules(rules)),
    results,
    agreement: summary.agreement,
    do_nothing_agreement: summary.do_nothing_agreement,
    holdout_agreement: summary.holdout_agreement,
    labeled: summary.labeled,
  });
  revalidatePath("/science");
}
