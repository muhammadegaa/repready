import type { Edit, Exercise } from "./schema";

// Volume (sets x reps) and load as a percentage of the plan, per exercise, after applying edits.
export function factors(edits: Edit[], planned: Exercise[]) {
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
    out.set(p.name.toLowerCase(), { volume: ((sets * reps) / (p.sets * p.reps)) * 100, load });
  }
  return out;
}

// Agreement per the spec: same decision, same exercises touched, volume and load within 10 points.
export function agrees(expected: { decision: string; edits: Edit[] }, actual: { decision: string; edits: Edit[] }, planned: Exercise[]): boolean {
  if (expected.decision !== actual.decision) return false;
  const a = factors(actual.edits, planned);
  const e = factors(expected.edits, planned);
  const swaps = (x: Edit[]) => x.filter((m) => m.kind === "swap").map((m) => m.exercise.toLowerCase()).sort().join("|");
  if (swaps(expected.edits) !== swaps(actual.edits)) return false;
  if (a.size !== e.size) return false;
  for (const [name, ef] of e) {
    const af = a.get(name);
    if (!af || Math.abs(af.volume - ef.volume) > 10 || Math.abs(af.load - ef.load) > 10) return false;
  }
  return true;
}

export type Scored = { expected: string | null; agree: boolean | null; holdout: boolean };

export function summarize(rows: Scored[]) {
  const labeled = rows.filter((r) => r.agree !== null);
  const pct = (xs: Scored[]) => (xs.length ? Math.round((xs.filter((r) => r.agree).length / xs.length) * 1000) / 10 : null);
  return {
    labeled: labeled.length,
    agreement: pct(labeled),
    do_nothing_agreement: pct(labeled.filter((r) => r.expected === "none")),
    holdout_agreement: pct(labeled.filter((r) => r.holdout)),
  };
}

export const PASS_OVERALL = 80;
export const PASS_DO_NOTHING = 100;
