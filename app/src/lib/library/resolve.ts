import type { ProgramSession } from "../program";
import { matchExercise } from "./index";

export type ResolveReport = { renamed: string[]; suggested: string[]; unmatched: string[] };

// Rename exact and alias matches to the library name so swaps and protected exercises line up.
// Near misses and unknown names stay as the coach typed them and are reported once.
export function resolveProgram(sessions: ProgramSession[]): { sessions: ProgramSession[]; report: ResolveReport } {
  const renamed = new Map<string, string>();
  const suggested = new Map<string, string>();
  const unmatched = new Set<string>();
  const out = sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map((e) => {
      const m = matchExercise(e.name);
      if (m.status === "matched") {
        if (m.exercise.name !== e.name) renamed.set(e.name, m.exercise.name);
        return { ...e, name: m.exercise.name };
      }
      if (m.status === "suggested") suggested.set(e.name, m.exercise.name);
      else unmatched.add(e.name);
      return e;
    }),
  }));
  return {
    sessions: out,
    report: {
      renamed: [...renamed].map(([a, b]) => `${a} → ${b}`),
      suggested: [...suggested].map(([a, b]) => `${a} (did you mean ${b}?)`),
      unmatched: [...unmatched],
    },
  };
}

export function describeReport(r: ResolveReport): string | null {
  const lines: string[] = [];
  if (r.renamed.length) lines.push(`Renamed to library names: ${r.renamed.join("; ")}.`);
  if (r.suggested.length) lines.push(`Kept as typed, possible matches: ${r.suggested.join("; ")}.`);
  if (r.unmatched.length) lines.push(`Not in the library, kept as typed: ${r.unmatched.join("; ")}. The agent can still reduce these but will not swap them.`);
  return lines.length ? lines.join("\n") : null;
}
