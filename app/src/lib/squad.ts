export const POSITIONS = ["Goalkeeper", "Centre-back", "Full-back", "Midfielder", "Winger", "Forward"] as const;

export type NewPlayer = { name: string; shirt: number | null; position: string; squad: string };

const MAX_PER_PASTE = 60;

// One player per line: name, shirt number, position, squad. Commas or tabs (a paste from Excel). Only the name is required.
export function parsePlayers(text: string): { players: NewPlayer[]; errors: string[] } {
  const players: NewPlayer[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cells = line.split(/\t|,/).map((c) => c.trim());
    if (i === 0 && cells[0].toLowerCase() === "name") return;
    const [name, shirt = "", position = "", squad = ""] = cells;
    const row = `Line ${i + 1}`;
    if (!name || name.length > 80) return void errors.push(`${row}: a name of 1 to 80 characters is needed.`);
    if (shirt !== "" && !/^\d{1,2}$/.test(shirt)) return void errors.push(`${row}: shirt number must be 1 to 99 or empty.`);
    if (position.length > 30 || squad.length > 30) return void errors.push(`${row}: position and squad must be 30 characters or fewer.`);
    players.push({ name, shirt: shirt === "" ? null : Number(shirt), position, squad: squad || "First team" });
  });
  if (players.length > MAX_PER_PASTE) errors.push(`Add at most ${MAX_PER_PASTE} players at a time.`);
  return { players: errors.length ? [] : players, errors };
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0];

export function inviteMessage(name: string, url: string): string {
  return `Hi ${firstName(name)}, this is your RepReady link: ${url}\nOpen it on your phone, agree to the terms, then check in each morning. The link works on one phone, so do not forward it.`;
}

export function squadMessage(club: string, url: string): string {
  return `${club} is using RepReady for daily player check-ins. Add yourself here: ${url}\nOpen it on your phone. Staff confirm you, then you check in each morning. Players aged 18 and over.`;
}
