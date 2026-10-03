// Groups: a coach splits the squad (starters, reserves, returning from injury) and may give a group its own version of a session.
// One rule decides which session a player gets, and every screen and the rules engine use it, so they cannot disagree.

export const EVERYONE = "Everyone";
export const GROUP_MAX = 30;

const SAME_AS_NONE = new Set(["", "everyone", "all", "squad", "base", "default"]);

// What a coach typed becomes a group name, or null for "no group" (Everyone).
export function cleanGroup(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim().replace(/\s+/g, " ");
  if (SAME_AS_NONE.has(t.toLowerCase())) return null;
  return t.slice(0, GROUP_MAX);
}

export const sameGroup = (a: string | null | undefined, b: string | null | undefined) =>
  (cleanGroup(a)?.toLowerCase() ?? null) === (cleanGroup(b)?.toLowerCase() ?? null);

export const groupLabel = (g: string | null | undefined) => cleanGroup(g) ?? EVERYONE;

// Among the sessions on one date, the player's group version if there is one, otherwise the version for everyone, otherwise none.
export function pickSession<T extends { group: string | null }>(onThatDate: T[], playerGroup: string | null | undefined): T | null {
  const mine = cleanGroup(playerGroup);
  if (mine) {
    const own = onThatDate.find((s) => sameGroup(s.group, mine));
    if (own) return own;
  }
  return onThatDate.find((s) => cleanGroup(s.group) === null) ?? null;
}

// Group names in use, most common first, for pick lists.
export function groupNames(players: { group: string | null }[], sessions: { group: string | null }[] = []): string[] {
  const count = new Map<string, number>();
  for (const x of [...players, ...sessions]) {
    const g = cleanGroup(x.group);
    if (g) count.set(g, (count.get(g) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([g]) => g);
}
