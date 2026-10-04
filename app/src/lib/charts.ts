import { addDays } from "./read/program";

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// Maps a value from [d0, d1] onto [r0, r1]. The range may run backwards (SVG y grows downwards).
export const scale = (d0: number, d1: number, r0: number, r1: number) => (v: number) => r0 + ((v - d0) * (r1 - r0)) / (d1 - d0);

// Runs of consecutive answered days, so a missing day breaks the line instead of being drawn through.
export function runs(values: (number | null)[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (v === null) { if (cur.length) out.push(cur); cur = []; } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}

export function ringGeometry(value: number, max: number, r: number) {
  const c = 2 * Math.PI * r;
  return { c, off: c * (1 - clamp01(max <= 0 ? 0 : value / max)) };
}

export const mondayOf = (date: string) => addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
export const weekDates = (date: string) => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i));

// Widths (in percent) of the segments of a bar, so they always add to at most 100 and a zero segment takes no room.
export function shares(parts: number[]): number[] {
  const total = parts.reduce((a, b) => a + b, 0);
  return parts.map((p) => (total === 0 ? 0 : (p / total) * 100));
}
