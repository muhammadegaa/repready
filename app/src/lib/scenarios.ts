import file from "./agent/scenarios.json";
import type { Exercise } from "./agent/schema";

export type DayInput = {
  day: number;
  sleep_h: number;
  stress: number;
  soreness: { overall: number; by_region: Record<string, number> };
  session: { completed: boolean; rpe_delta: number } | null;
  note: string | null;
};
export type ScenarioRow = {
  id: string;
  holdout: boolean;
  athlete: { sport: string; level: string; training_age_years: number; age_group: string };
  planned_session: { label: string; week_type: string; exercises: Exercise[] };
  last_14_days: DayInput[];
};

export const SCENARIOS = (file.scenarios as unknown as (Omit<ScenarioRow, "holdout"> & { holdout?: boolean })[]).map((s) => ({ ...s, holdout: Boolean(s.holdout) })) as ScenarioRow[];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? null;
