import type { Edit, Exercise } from "./schema";

export type ShownExercise = Exercise & { note?: string };

export function applyEdits(planned: Exercise[], edits: Edit[]): ShownExercise[] {
  return planned.map((e) => {
    const mine = edits.filter((x) => x.exercise.toLowerCase() === e.name.toLowerCase());
    if (!mine.length) return { ...e };
    const out: ShownExercise = { ...e };
    const notes: string[] = [];
    for (const x of mine) {
      if (x.kind === "set_sets") { out.sets = x.to; notes.push(`sets ${e.sets} to ${x.to}`); }
      if (x.kind === "set_reps") { out.reps = x.to; notes.push(`reps ${e.reps} to ${x.to}`); }
      if (x.kind === "set_load_pct") { out.load = `${x.to_pct_of_planned}% of ${e.load}`; notes.push(`load ${x.to_pct_of_planned}% of plan`); }
      if (x.kind === "swap") { out.name = x.to_exercise; notes.push(`swapped from ${e.name}`); }
    }
    out.note = `Adjusted: ${notes.join(", ")}`;
    return out;
  });
}

export function describeEdit(x: Edit): string {
  if (x.kind === "set_sets") return `${x.exercise}: sets to ${x.to}`;
  if (x.kind === "set_reps") return `${x.exercise}: reps to ${x.to}`;
  if (x.kind === "set_load_pct") return `${x.exercise}: load to ${x.to_pct_of_planned}% of plan`;
  return `${x.exercise}: swap for ${x.to_exercise}`;
}
