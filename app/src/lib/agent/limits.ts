import type { Edit, Exercise, Proposal } from "./schema";

export const MAX_REDUCTION = 0.25;

const MEDICAL_LANGUAGE =
  /\b(diagnos\w*|treat(?:ment|ing)?|cure|prescrib\w*|therap\w*|rehab\w*|prevent\w*\s+(?:an?\s+)?injur\w*)\b/i;

export type LimitContext = {
  injuryFlaggedExercises: string[];
  clearedExercises: string[];
};

export type Verdict = {
  accepted: Edit[];
  rejected: { edit: Edit; why: string }[];
  reasonOk: boolean;
};

const norm = (s: string) => s.trim().toLowerCase();

export function enforceLimits(planned: Exercise[], proposal: Proposal, ctx: LimitContext): Verdict {
  const floor = 1 - MAX_REDUCTION;
  const state = new Map(planned.map((e) => [norm(e.name), { planned: e, sets: e.sets, reps: e.reps, loadPct: 100 }]));
  const flagged = new Set(ctx.injuryFlaggedExercises.map(norm));
  const cleared = new Set(ctx.clearedExercises.map(norm));
  const accepted: Edit[] = [];
  const rejected: Verdict["rejected"] = [];

  for (const edit of proposal.edits) {
    const key = norm(edit.exercise);
    const s = state.get(key);
    if (!s) {
      rejected.push({ edit, why: "exercise is not in the planned session" });
      continue;
    }
    if (flagged.has(key) && !cleared.has(key)) {
      rejected.push({ edit, why: "exercise has an injury flag and is not cleared by the coach" });
      continue;
    }
    if (edit.kind === "swap") {
      accepted.push(edit);
      continue;
    }
    const next = { sets: s.sets, reps: s.reps, loadPct: s.loadPct };
    if (edit.kind === "set_sets") next.sets = edit.to;
    if (edit.kind === "set_reps") next.reps = edit.to;
    if (edit.kind === "set_load_pct") next.loadPct = edit.to_pct_of_planned;

    if (next.sets > s.planned.sets || next.reps > s.planned.reps || next.loadPct > 100) {
      rejected.push({ edit, why: "edit would raise sets, reps or load above the plan" });
      continue;
    }
    const volume = (next.sets * next.reps) / (s.planned.sets * s.planned.reps);
    if (volume < floor || next.loadPct / 100 < floor) {
      rejected.push({ edit, why: `edit would cut volume or load by more than ${MAX_REDUCTION * 100}%` });
      continue;
    }
    s.sets = next.sets;
    s.reps = next.reps;
    s.loadPct = next.loadPct;
    accepted.push(edit);
  }

  const reasonText = [proposal.reason, proposal.flag_to_coach ?? ""].join(" ");
  return { accepted, rejected, reasonOk: !MEDICAL_LANGUAGE.test(reasonText) };
}
