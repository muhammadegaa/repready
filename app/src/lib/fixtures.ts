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

// ---- reading a fixture list as a coach has it: "Sat 11 Oct v Reading (H)", "11/10/2026", "2026-10-11", "Saturday 11th October"
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number) => {
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return new Date(`${s}T00:00:00Z`).toISOString().startsWith(s) ? s : null;
};
// A date with no year is the next time it comes round, counting from a couple of months back so a recent match is not pushed a year on.
const withYear = (m: number, d: number, today: string): string | null => {
  const y = Number(today.slice(0, 4));
  const floor = days(today, "1970-01-01") - 60;
  for (const year of [y, y + 1, y - 1]) {
    const s = iso(year, m, d);
    if (s && days(s, "1970-01-01") >= floor) return s;
  }
  return null;
};
const monthNo = (w: string) => MONTHS.indexOf(w.slice(0, 3).toLowerCase()) + 1;

export function readFixtureDates(text: string, today: string): { dates: string[]; unreadable: string[] } {
  const found = new Set<string>();
  const unreadable: string[] = [];
  for (const raw of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const line = raw.replace(/(\d)(st|nd|rd|th)\b/gi, "$1");
    const before = found.size;
    let hits = 0;
    const take = (s: string | null) => { hits++; if (s) found.add(s); };
    for (const m of line.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) take(iso(+m[1], +m[2], +m[3]));
    for (const m of line.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2}|\d{4})\b/g)) take(iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1])); // day first, as in the UK
    for (const m of line.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?\b/g)) {
      const mo = monthNo(m[2]);
      if (mo) take(m[3] ? iso(+m[3], mo, +m[1]) : withYear(mo, +m[1], today));
    }
    for (const m of line.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/g)) {
      const mo = monthNo(m[1]);
      if (mo && !/\d\s+[A-Za-z]/.test(line.slice(Math.max(0, (m.index ?? 0) - 3), m.index))) take(m[3] ? iso(+m[3], mo, +m[2]) : withYear(mo, +m[2], today));
    }
    if (hits === 0 || found.size === before && hits > 0 && ![...found].length) unreadable.push(raw.slice(0, 60));
  }
  return { dates: [...found].sort(), unreadable };
}
