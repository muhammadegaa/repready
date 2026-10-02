const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

export function parseFixtures(text: string): { dates: string[]; errors: string[] } {
  const errors: string[] = [];
  const dates = new Set<string>();
  for (const t of text.split(/[\s,;]+/).filter(Boolean)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || Number.isNaN(Date.parse(`${t}T00:00:00Z`))) errors.push(`"${t}" is not a date (use YYYY-MM-DD)`);
    else dates.add(t);
  }
  return { dates: errors.length ? [] : [...dates].sort(), errors };
}

// "MD-2" is two days before a match, "MD" is match day, "MD+1" the day after. Nothing within 3 days either side: null.
export function matchDayTag(date: string, fixtures: string[]): string | null {
  let best: number | null = null;
  for (const f of fixtures) {
    const off = days(date, f);
    if (off < -3 || off > 3) continue;
    // Closest fixture wins; on a tie the coming match matters more than the last one.
    if (best === null || Math.abs(off) < Math.abs(best) || (Math.abs(off) === Math.abs(best) && off < best)) best = off;
  }
  if (best === null) return null;
  return best === 0 ? "MD" : best < 0 ? `MD${best}` : `MD+${best}`;
}
