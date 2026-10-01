import type { Edit, Exercise } from "./agent/schema";

export type EditLimits = { minVolume: number; minLoad: number };

// The coach may cut deeper than the agent's cap. The expert's labels use the agent's cap so the two are comparable.
export const COACH_LIMITS: EditLimits = { minVolume: 0.25, minLoad: 50 };
export const AGENT_LIMITS: EditLimits = { minVolume: 0.75, minLoad: 75 };

// Reads sets_i, reps_i, load_i and swap_i for each planned exercise; empty means unchanged.
export function buildEdits(get: (key: string) => string, planned: Exercise[], limits: EditLimits): { edits: Edit[]; error: string | null } {
  const edits: Edit[] = [];
  for (let i = 0; i < planned.length; i++) {
    const e = planned[i];
    const sets = get(`sets_${i}`).trim(), reps = get(`reps_${i}`).trim(), load = get(`load_${i}`).trim(), swap = get(`swap_${i}`).trim();
    const ns = sets === "" ? e.sets : Number(sets);
    const nr = reps === "" ? e.reps : Number(reps);
    if (!Number.isInteger(ns) || !Number.isInteger(nr) || ns < 1 || nr < 1) return { edits: [], error: `${e.name}: sets and reps must be whole numbers of at least 1.` };
    if (ns > e.sets || nr > e.reps) return { edits: [], error: `${e.name}: sets and reps cannot go above the plan.` };
    if ((ns * nr) / (e.sets * e.reps) < limits.minVolume) return { edits: [], error: `${e.name}: that cuts volume by more than ${Math.round((1 - limits.minVolume) * 100)}%.` };
    if (ns !== e.sets) edits.push({ kind: "set_sets", exercise: e.name, to: ns });
    if (nr !== e.reps) edits.push({ kind: "set_reps", exercise: e.name, to: nr });
    if (load !== "") {
      const l = Number(load);
      if (!Number.isFinite(l) || l < limits.minLoad || l > 100) return { edits: [], error: `${e.name}: load must be ${limits.minLoad} to 100 percent of plan.` };
      if (l !== 100) edits.push({ kind: "set_load_pct", exercise: e.name, to_pct_of_planned: l });
    }
    if (swap) {
      if (swap.length > 60) return { edits: [], error: `${e.name}: swap name is too long.` };
      edits.push({ kind: "swap", exercise: e.name, to_exercise: swap });
    }
  }
  return { edits, error: null };
}
