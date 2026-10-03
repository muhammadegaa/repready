export const POSITIONS = ["Goalkeeper", "Centre-back", "Full-back", "Midfielder", "Winger", "Forward"] as const;

export type NewPlayer = { name: string; shirt: number | null; position: string; squad: string };

const MAX_PER_PASTE = 60;

export type ReadPlayer = NewPlayer & { group: string };

const POSITION_WORDS: Record<string, (typeof POSITIONS)[number]> = {
  gk: "Goalkeeper", goalkeeper: "Goalkeeper", keeper: "Goalkeeper", goalie: "Goalkeeper",
  cb: "Centre-back", "centre-back": "Centre-back", "center-back": "Centre-back", "centre back": "Centre-back", "center back": "Centre-back", defender: "Centre-back", cd: "Centre-back",
  lb: "Full-back", rb: "Full-back", lwb: "Full-back", rwb: "Full-back", fb: "Full-back", "full-back": "Full-back", "full back": "Full-back", fullback: "Full-back", "left back": "Full-back", "right back": "Full-back",
  cm: "Midfielder", cdm: "Midfielder", cam: "Midfielder", dm: "Midfielder", am: "Midfielder", mid: "Midfielder", midfield: "Midfielder", midfielder: "Midfielder",
  lw: "Winger", rw: "Winger", wing: "Winger", winger: "Winger", lm: "Winger", rm: "Winger",
  st: "Forward", cf: "Forward", fw: "Forward", striker: "Forward", forward: "Forward", attacker: "Forward",
};
const asPosition = (c: string) => POSITION_WORDS[c.toLowerCase().replace(/[().]/g, "").trim()] ?? null;
const SHIRT = /^#?\d{1,2}$/;

type Col = "name" | "shirt" | "position" | "squad" | "group";
const HEADER_WORDS: Record<string, Col> = {
  name: "name", player: "name", "player name": "name", "full name": "name", athlete: "name",
  shirt: "shirt", number: "shirt", no: "shirt", "no.": "shirt", "#": "shirt", "shirt number": "shirt", "squad number": "shirt", num: "shirt",
  position: "position", pos: "position", role: "position",
  squad: "squad", team: "squad", "age group": "squad", age: "squad",
  group: "group", "training group": "group", unit: "group",
};

const split = (line: string) => {
  const d = line.includes("\t") ? "\t" : line.includes("|") ? "|" : line.includes(";") ? ";" : ",";
  return line.split(d).map((c) => c.trim().replace(/^"|"$/g, "").trim());
};

// Reads a squad list as a coach has it: a pasted column of names, a spreadsheet, with or without a header row,
// columns in any order. Only the name is needed. Lines it cannot use are listed; the rest are kept.
export function readSquad(text: string): { players: ReadPlayer[]; skipped: string[]; tooMany: boolean } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const players: ReadPlayer[] = [];
  const skipped: string[] = [];
  let cols: Col[] | null = null;
  const first = lines[0] ? split(lines[0]) : [];
  const mapped = first.map((c) => HEADER_WORDS[c.toLowerCase()]);
  if (mapped.filter(Boolean).length >= 1 && mapped.some((m) => m === "name")) {
    cols = mapped.map((m) => m ?? ("skip" as Col));
    lines.shift();
  }
  for (const line of lines) {
    if (/^sheet:/i.test(line)) continue;
    let name = "", shirt: number | null = null, position = "", squad = "", group = "", bad = false;
    const cells = split(line);
    if (cols) {
      cells.forEach((c, i) => {
        const col = cols![i];
        if (!c) return;
        if (col === "name") name = c;
        else if (col === "shirt") { if (SHIRT.test(c)) shirt = Number(c.replace("#", "")); else bad = true; }
        else if (col === "position") position = asPosition(c) ?? (c.length <= 30 ? c : "");
        else if (col === "squad") squad = c;
        else if (col === "group") group = c;
      });
    } else if (cells.length === 1) {
      // "7 Jo Smith", "Jo Smith 7", "Jo Smith (CB) #7" or just "Jo Smith"
      let c = cells[0];
      const pos = c.match(/\(([^)]+)\)/);
      if (pos) { position = asPosition(pos[1]) ?? ""; c = c.replace(pos[0], " "); }
      const lead = c.match(/^#?(\d{1,2})[.)\s-]+(.+)$/), trail = c.match(/^(.+?)[\s-]+#?(\d{1,2})$/);
      if (lead) { shirt = Number(lead[1]); c = lead[2]; } else if (trail) { shirt = Number(trail[2]); c = trail[1]; }
      name = c.replace(/\s+/g, " ").trim();
    } else {
      for (const c of cells) {
        if (!c) continue;
        if (shirt === null && SHIRT.test(c)) shirt = Number(c.replace("#", ""));
        else if (!position && asPosition(c)) position = asPosition(c)!;
        else if (!name) name = c;
        else if (!squad) squad = c;
        else if (!group) group = c;
      }
    }
    if (bad || !name || name.length > 80 || /^\d+$/.test(name) || shirt === 0 || squad.length > 30 || group.length > 30) { skipped.push(line.slice(0, 60)); continue; }
    players.push({ name, shirt, position, squad: squad || "First team", group });
  }
  return { players: players.slice(0, MAX_PER_PASTE), skipped, tooMany: players.length > MAX_PER_PASTE };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

export function inviteMessage(name: string, url: string): string {
  return `Hi ${firstName(name)}, this is your RepReady link: ${url}\nOpen it on your phone, agree to the terms, then check in each morning. The link works on one phone, so do not forward it.`;
}

export function squadMessage(club: string, url: string): string {
  return `${club} is using RepReady for daily player check-ins. Add yourself here: ${url}\nOpen it on your phone. Staff confirm you, then you check in each morning. Players aged 18 and over.`;
}

// The preview is stored as the players already read, and re-checked here before anyone is created.
export function storedPlayers(stored: string | null): ReadPlayer[] {
  try {
    const d = JSON.parse(stored ?? "") as { players?: ReadPlayer[] };
    return (d.players ?? []).filter((p) => typeof p.name === "string" && p.name && p.name.length <= 80).slice(0, MAX_PER_PASTE)
      .map((p) => ({ name: p.name, shirt: Number.isInteger(p.shirt) && p.shirt! >= 1 && p.shirt! <= 99 ? p.shirt : null, position: String(p.position ?? "").slice(0, 30), squad: String(p.squad || "First team").slice(0, 30), group: String(p.group ?? "").slice(0, 30) }));
  } catch {
    return [];
  }
}
