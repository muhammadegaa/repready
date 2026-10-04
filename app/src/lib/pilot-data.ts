import { dayStr, todayStr } from "./run-agent";
import type { ClubFacts } from "./pilot";
import { checkinCodesSince, listAthletes, listClubs, listProposals, listSessions, type ClubRow } from "./store";

// The facts the pilot view needs for one club. Fictional sample players and sessions never count.
export async function clubFacts(c: ClubRow): Promise<ClubFacts> {
  const today = todayStr();
  const from = dayStr(today, 6);
  const [athletes, sessions, codes, proposals] = await Promise.all([listAthletes(c.id), listSessions(c.id, "2000-01-01", 400), checkinCodesSince(c.id, from), listProposals(c.id, 300)]);
  const real = athletes.filter((a) => a.approved && !a.sample);
  const mine = new Set(real.map((a) => a.code));
  const recent = proposals.filter((p) => mine.has(p.athlete_code) && p.on_date >= from && (p.status === "pending" || p.status === "approved" || p.status === "rejected"));
  return {
    id: c.id, name: c.name, paid: Boolean(c.paid_at),
    daysOld: Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(c.created_at)) / 86_400_000)),
    players: real.length, consented: real.filter((a) => a.consented_at).length,
    sessions: sessions.filter((s) => !s.sample).length,
    checkins7: codes.filter((x) => mine.has(x)).length, possible7: real.length * 7,
    proposals7: recent.length, decided7: recent.filter((p) => p.status !== "pending").length,
  };
}

export async function allClubFacts(): Promise<ClubFacts[]> {
  const clubs = (await listClubs()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return Promise.all(clubs.map(clubFacts));
}
