// Match minutes as a coach jots them: "Ola Adeyemi 90", "Mensah - 65", "J. Ortiz 20 mins", "Sam DNP". Read in our own code,
// because it carries player names. Each line is matched to exactly one player or listed as unmatched.
export type NamedPlayer = { code: string; name: string };
export type MinutesRow = { code: string; name: string; minutes: number };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s'-]/g, " ").replace(/(^|\s)[-']+(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
const NOT_PLAYED = /\b(dnp|did not play|didn'?t play|unused|not used|nps|bench(?:ed)?)\b/i;

export function readMinutes(text: string, players: NamedPlayer[]): { rows: MinutesRow[]; unmatched: string[] } {
  const rows = new Map<string, MinutesRow>();
  const unmatched: string[] = [];
  const book = players.map((p) => {
    const parts = norm(p.name).split(" ");
    return { p, full: parts.join(" "), first: parts[0], last: parts[parts.length - 1], initial: parts[0]?.[0] };
  });
  for (const raw of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const nums = [...raw.matchAll(/(?<![\d.])(\d{1,3})(?![\d.])\s*(?:'|′|mins?|minutes?)?/g)];
    const played = NOT_PLAYED.test(raw);
    const num = nums.length ? Number(nums[nums.length - 1][1]) : null;
    const minutes = played ? 0 : num;
    const who = norm(raw.replace(NOT_PLAYED, " ").replace(/\d+\s*(?:'|′|mins?|minutes?)?/gi, " "));
    if (!who || minutes === null || minutes > 130) { unmatched.push(raw.slice(0, 60)); continue; }
    const tokens = who.split(" ");
    const hit = (pred: (b: (typeof book)[number]) => boolean) => book.filter(pred);
    let found = hit((b) => b.full === who);
    if (found.length !== 1) found = hit((b) => tokens.length === 1 && b.last === who);
    if (found.length !== 1) found = hit((b) => tokens.length >= 2 && b.last === tokens[tokens.length - 1] && (b.first === tokens[0] || b.initial === tokens[0][0]));
    if (found.length !== 1) found = hit((b) => tokens.length === 1 && b.first === who);
    if (found.length !== 1) { unmatched.push(raw.slice(0, 60)); continue; }
    rows.set(found[0].p.code, { code: found[0].p.code, name: found[0].p.name, minutes });
  }
  return { rows: [...rows.values()], unmatched };
}
