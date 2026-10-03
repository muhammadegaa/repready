import { resolvePlan, type ResolvedPlan } from "./overrides";
import { pickSession } from "./groups";
import { listActiveOverrides, listSessions, sessionFor, type AthleteRow, type SessionRow } from "./store";

export type PlayerPlan = { session: SessionRow; resolved: ResolvedPlan };

// The plan one player has on one date: their group's version of the session (else the one for everyone), then their own overrides.
// The rules, the coach's cards, the "change the numbers" form and the player's screen all start from this.
export async function planFor(athlete: Pick<AthleteRow, "club" | "code" | "group">, date: string): Promise<PlayerPlan | null> {
  const [session, overrides] = await Promise.all([sessionFor(athlete.club, date, athlete.group), listActiveOverrides(athlete.code, date)]);
  if (!session) return null;
  return { session, resolved: resolvePlan(session.exercises, overrides, date) };
}

// The same session with the player's overrides already applied, for screens that take a session.
export const withResolved = (p: PlayerPlan): SessionRow => ({ ...p.session, exercises: p.resolved.exercises });

// Exercises this player will actually get in the coming sessions (their group's versions), plus any they have protected.
// These are the only exercises a coach can protect or override for them.
export async function playerExerciseNames(athlete: Pick<AthleteRow, "club" | "group" | "protected">, today: string): Promise<string[]> {
  const upcoming = await listSessions(athlete.club, today, 80);
  const byDate = new Map<string, SessionRow[]>();
  for (const u of upcoming) byDate.set(u.on_date, [...(byDate.get(u.on_date) ?? []), u]);
  const mine = [...byDate.values()].map((rows) => pickSession(rows, athlete.group)).filter((x): x is SessionRow => x !== null);
  return [...new Set(mine.flatMap((x) => x.exercises.map((e) => e.name)).concat(athlete.protected))].sort();
}
