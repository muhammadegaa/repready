import type { Exercise } from "./agent/schema";

export type ProgramSession = { on_date: string; label: string; week_type: "normal" | "deload"; exercises: Exercise[]; group: string | null };
