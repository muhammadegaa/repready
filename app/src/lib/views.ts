import { dayStr } from "./run-agent";
import {
  getAthlete, getCheckin, getCheckins, getProposal, getReadiness, getReadinessOn, getSessionLogs, listAthletes, listEvents, listProposals,
  listProposalsFor, listSessions, sessionBefore, sessionOn, sessionsOnDates,
  type AthleteRow, type CheckinRow, type EventRow, type ProposalRow, type ReadinessRow, type SessionRow,
} from "./store";

export type Status = "invited" | "waiting" | "analysing" | "no_session" | "on_plan" | "needs_decision" | "adjusted" | "kept_plan" | "agent_error";

export const STATUS: Record<Status, { label: string; tone: "neutral" | "ok" | "warn" | "bad" | "marker" }> = {
  invited: { label: "Not joined", tone: "neutral" },
  waiting: { label: "Not checked in", tone: "neutral" },
  analysing: { label: "Reading numbers", tone: "neutral" },
  no_session: { label: "No session today", tone: "neutral" },
  on_plan: { label: "On plan", tone: "ok" },
  needs_decision: { label: "Needs you", tone: "warn" },
  adjusted: { label: "Adjusted", tone: "marker" },
  kept_plan: { label: "Kept plan", tone: "ok" },
  agent_error: { label: "No proposal", tone: "bad" },
};

const AGENT_GRACE_MS = 90_000;

export function statusOf(a: AthleteRow, session: SessionRow | null, checkinAt: string | null | undefined, proposal: ProposalRow | null, now = Date.now()): Status {
  if (!a.consented_at) return "invited";
  if (!session) return "no_session";
  if (!checkinAt) return "waiting";
  if (!proposal) return now - Date.parse(checkinAt) < AGENT_GRACE_MS ? "analysing" : "agent_error";
  switch (proposal.status) {
    case "pending": return "needs_decision";
    case "approved": return "adjusted";
    case "rejected": return "kept_plan";
    case "no_change": return "on_plan";
    default: return "agent_error";
  }
}

export type RosterEntry = {
  athlete: AthleteRow;
  status: Status;
  checkin: (CheckinRow & { created_at: string | null }) | null;
  readiness: ReadinessRow | null;
  proposal: ProposalRow | null;
  sleep7: (number | null)[];
};

export async function coachToday(club: string, today: string) {
  const dates7 = Array.from({ length: 7 }, (_, i) => dayStr(today, 6 - i));
  const [everyone, session, events, recent] = await Promise.all([listAthletes(club), sessionOn(club, today), listEvents(club, 14), listProposals(club, 30)]);
  const athletes = everyone.filter((a) => a.approved);
  const roster: RosterEntry[] = await Promise.all(
    athletes.map(async (athlete) => {
      const [checkin, readiness, proposal, week] = await Promise.all([
        getCheckin(athlete.code, today), getReadiness(athlete.code, today), getProposal(athlete.code, today), getCheckins(athlete.code, dates7),
      ]);
      return {
        athlete, checkin, readiness, proposal,
        status: statusOf(athlete, session, checkin?.created_at ?? (checkin ? new Date(0).toISOString() : null), proposal),
        sleep7: dates7.map((d) => week.get(d)?.sleep_h ?? null),
      };
    }),
  );
  const pending = roster.filter((r) => r.status === "needs_decision");
  const decided = recent.filter((p) => p.status === "approved" || p.status === "rejected");
  return {
    session, roster, pending, events, decided, waiting: everyone.length - athletes.length,
    counts: {
      athletes: athletes.length,
      checkedIn: roster.filter((r) => r.checkin).length,
      needsDecision: pending.length,
      adjusted: roster.filter((r) => r.status === "adjusted").length,
    },
  };
}

export type DayPoint = { date: string; sleep: number | null; device: number | null; soreness: number | null; stress: number | null; rpeDelta: number | null; note: string | null };

export async function athleteDetail(code: string, today: string) {
  const athlete = await getAthlete(code);
  if (!athlete) return null;
  const club = athlete.club;
  const dates = Array.from({ length: 14 }, (_, i) => dayStr(today, 13 - i));
  const [checkins, readiness, logs, sessions, proposals, todaySession, upcoming, events] = await Promise.all([
    getCheckins(code, dates), getReadinessOn(code, dates), getSessionLogs(code, dates), sessionsOnDates(club, dates),
    listProposalsFor(code, 20), sessionOn(club, today), listSessions(club, today, 40), listEvents(club, 40),
  ]);
  const target = new Map(sessions.map((s) => {
    const t = s.exercises.map((e) => e.target_rpe).filter((x): x is number => typeof x === "number");
    return [s.on_date, t.length ? t.reduce((a, b) => a + b, 0) / t.length : null] as const;
  }));
  const days: DayPoint[] = dates.map((date) => {
    const c = checkins.get(date), r = readiness.get(date), rpe = logs.get(date), t = target.get(date) ?? null;
    return {
      date,
      sleep: r?.sleep_h ?? c?.sleep_h ?? null,
      device: r?.sleep_h ?? null,
      soreness: c?.soreness ?? null,
      stress: c?.stress ?? null,
      rpeDelta: rpe === undefined || t === null ? null : Math.round((rpe - t) * 10) / 10,
      note: c?.note ?? null,
    };
  });
  const names = [...new Set(upcoming.flatMap((s) => s.exercises.map((e) => e.name)).concat(athlete.protected))].sort();
  return {
    athlete, days, proposals, todaySession, exerciseNames: names,
    wearable: readiness.get(today) ?? null,
    events: events.filter((e) => e.athlete_code === code).slice(0, 12),
  };
}

export async function athleteToday(code: string, today: string) {
  const athlete = await getAthlete(code);
  if (!athlete) return null;
  const club = athlete.club;
  const dates7 = Array.from({ length: 7 }, (_, i) => dayStr(today, 6 - i));
  const [session, checkin, readiness, proposal, week, prev, logsWeek] = await Promise.all([
    sessionOn(club, today), getCheckin(code, today), getReadiness(code, today), getProposal(code, today), getCheckins(code, dates7),
    sessionBefore(club, today), getSessionLogs(code, [today]),
  ]);
  const prevLogged = prev ? (await getSessionLogs(code, [prev.on_date])).has(prev.on_date) : true;
  return {
    athlete, session, checkin, readiness, proposal,
    status: statusOf(athlete, session, checkin?.created_at ?? (checkin ? new Date(0).toISOString() : null), proposal),
    week: dates7.map((date) => ({ date, checked: week.has(date) })),
    rpeToday: logsWeek.get(today) ?? null,
    prev: prev && !prevLogged ? prev : null,
  };
}

export type { EventRow };
