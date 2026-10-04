// The numbers inside four rules that decide how often the agent interrupts the coach. Each has a default, a safe range, and a step.
// Loosening only ever means "fire a little less often". The hard limits (never raise load, cut at most a quarter, pain stops everything)
// are not here and cannot be changed from here.
export type Thresholds = { R1_sleep: number; R2_over: number; R3_soreness: number; R4_stress: number };
export type TKey = keyof Thresholds;

export const DEFAULTS: Thresholds = { R1_sleep: 6, R2_over: 2, R3_soreness: 7, R4_stress: 8 };

export const TUNABLE: Record<TKey, { rule: "R1" | "R2" | "R3" | "R4"; min: number; max: number; step: number; loosen: 1 | -1; unit: string; label: string }> = {
  R1_sleep: { rule: "R1", min: 5, max: 7, step: 0.5, loosen: -1, unit: " h", label: "sleep below" },
  R2_over: { rule: "R2", min: 1.5, max: 3, step: 0.5, loosen: 1, unit: " RPE points", label: "effort above target by" },
  R3_soreness: { rule: "R3", min: 6, max: 9, step: 1, loosen: 1, unit: "/10", label: "soreness at" },
  R4_stress: { rule: "R4", min: 7, max: 9, step: 1, loosen: 1, unit: "/10", label: "stress at" },
};

export const KEYS = Object.keys(TUNABLE) as TKey[];
export const keyOfRule = (rule: string): TKey | null => KEYS.find((k) => TUNABLE[k].rule === rule) ?? null;

export const clamp = (k: TKey, v: number) => Math.min(TUNABLE[k].max, Math.max(TUNABLE[k].min, v));

// What a stored value means: anything unreadable or out of range falls back to the default rather than being trusted.
export function readThresholds(stored: unknown): Thresholds {
  const o = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const out = { ...DEFAULTS };
  for (const k of KEYS) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= TUNABLE[k].min && v <= TUNABLE[k].max) out[k] = v;
  }
  return out;
}

// The next step toward "fires less often", or null when already at the end of the safe range.
export function looserStep(k: TKey, current: number): number | null {
  const t = TUNABLE[k];
  const next = Math.round((current + t.loosen * t.step) * 100) / 100;
  return next >= t.min && next <= t.max ? next : null;
}

// The rule's trigger sentence with the club's own number in it.
export function triggerText(rule: string, t: Thresholds): string | null {
  switch (rule) {
    case "R1": return `sleep_h below ${t.R1_sleep} on each of the last 2 nights`;
    case "R2": return `rpe_delta of +${t.R2_over} or more on 3 of the last 4 sessions`;
    case "R3": return `soreness ${t.R3_soreness} or above in a muscle group the planned session loads heavily`;
    case "R4": return `stress ${t.R4_stress} or above and sleep_h below 6.5 on the same day`;
    default: return null;
  }
}
