// "Usual" for one player: their own mean over the days before today, plus or minus one standard deviation.
// It describes; it does not decide anything. With fewer than MIN_DAYS earlier answers there is no usual range, and we say so.
export const MIN_DAYS = 5;

export type Usual = { n: number; mean: number; low: number; high: number };
export type Standing = "lower" | "usual" | "higher";

const round1 = (x: number) => Math.round(x * 10) / 10;

// `room` is the smallest move worth calling different for this measure (half an hour of sleep, one point on a 0 to 10 scale).
// A very steady player would otherwise be flagged for a change that is just the scale ticking over, so the band is never
// narrower than the mean plus or minus `room`. The band shown and the verdict come from the same numbers.
export function usualRange(earlier: (number | null)[], room = 0): Usual | null {
  const v = earlier.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (v.length < MIN_DAYS) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  const half = Math.max(sd, room);
  return { n: v.length, mean: round1(mean), low: round1(mean - half), high: round1(mean + half) };
}

export function standing(today: number | null, usual: Usual | null): Standing | null {
  if (today === null || usual === null) return null;
  if (today < usual.low) return "lower";
  if (today > usual.high) return "higher";
  return "usual";
}
