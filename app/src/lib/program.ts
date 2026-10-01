import type { Exercise } from "./agent/schema";

export type ProgramSession = { on_date: string; label: string; week_type: "normal" | "deload"; exercises: Exercise[] };

const HEADER = "date,label,week_type,exercise,sets,reps,load,target_rpe";

export function parseProgram(text: string): { sessions: ProgramSession[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const bySession = new Map<string, ProgramSession>();
  if (!lines.length || lines[0].toLowerCase().replace(/\s/g, "") !== HEADER) {
    return { sessions: [], errors: [`First line must be: ${HEADER}`] };
  }
  lines.slice(1).forEach((line, i) => {
    const row = i + 2;
    const [date, label, weekType, name, sets, reps, load, rpe] = line.split(",").map((c) => c.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return void errors.push(`Row ${row}: date must be YYYY-MM-DD`);
    if (weekType !== "normal" && weekType !== "deload") return void errors.push(`Row ${row}: week_type must be normal or deload`);
    const s = Number(sets), r = Number(reps);
    if (!name || !Number.isInteger(s) || s < 1 || !Number.isInteger(r) || r < 1) return void errors.push(`Row ${row}: needs exercise name and whole-number sets and reps`);
    const target = rpe === "" || rpe === undefined ? null : Number(rpe);
    if (target !== null && Number.isNaN(target)) return void errors.push(`Row ${row}: target_rpe must be a number or empty`);
    const key = `${date}|${label}`;
    const session = bySession.get(key) ?? { on_date: date, label, week_type: weekType, exercises: [] };
    session.exercises.push({ name, sets: s, reps: r, load: load ?? "", target_rpe: target });
    bySession.set(key, session);
  });
  return { sessions: errors.length ? [] : [...bySession.values()], errors };
}
