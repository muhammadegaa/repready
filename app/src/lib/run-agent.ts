import { decide } from "./agent/engine";
import { matchDayTag } from "./fixtures";
import { planFor } from "./plan";
import type { Scenario } from "./agent/propose";
import type { Exercise } from "./agent/schema";
import { mayAutoApply, ruleStats } from "./autonomy";
import { CONSENT_VERSION } from "./consent";
import { activeRules, allRules } from "./rules";
import {
  clubOf, decideProposal, getAthlete, getAutonomy, getFixtures, listProposals, getCheckins, getProposal, getReadinessOn, getSessionLogs, saveProposal, sessionsForDates,
  type ProposalRow, type SessionRow,
} from "./store";

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const dayStr = (today: string, back: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

function meanTarget(ex: Exercise[]): number | null {
  const t = ex.map((e) => e.target_rpe).filter((x): x is number => typeof x === "number");
  return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
}

async function buildScenario(code: string, today: string, session: SessionRow, group: string | null, planned: SessionRow["exercises"]): Promise<Scenario> {
  const dates = Array.from({ length: 14 }, (_, i) => dayStr(today, 13 - i));
  const [checkins, logs, sessions, readiness] = await Promise.all([
    getCheckins(code, dates),
    getSessionLogs(code, dates),
    sessionsForDates(clubOf(code), dates, group),
    getReadinessOn(code, dates),
  ]);
  const target = new Map(sessions.map((s) => [s.on_date, meanTarget(s.exercises)]));
  const days = dates.map((date, i) => {
    const c = checkins.get(date);
    const r = readiness.get(date);
    const rpe = logs.get(date);
    const t = target.get(date) ?? null;
    return {
      day: i - 13,
      sleep_h: r?.sleep_h ?? c?.sleep_h ?? null,
      reported_sleep_h: c?.sleep_h ?? null,
      hrv_ms: r?.hrv_ms ?? null,
      resting_hr: r?.resting_hr ?? null,
      wearable: r?.provider ?? null,
      stress: c?.stress ?? null,
      soreness: { overall: c?.soreness ?? null, by_region: {} },
      session: rpe === undefined ? null : { completed: true, rpe_delta: t === null ? null : Math.round((rpe - t) * 10) / 10 },
      availability: c?.availability ?? null,
      note: c?.note || null,
    };
  });
  return {
    athlete: { age_group: "adult" },
    planned_session: { label: session.label, week_type: session.week_type, match_day: matchDayTag(session.on_date, await getFixtures(clubOf(code))), exercises: planned },
    last_14_days: days,
  };
}

export async function runAgentFor(code: string, today: string): Promise<void> {
  const athlete = await getAthlete(code);
  if (!athlete) return;
  // The version of today's session this player gets: their group's, else the one for everyone.
  const [plan, existing] = await Promise.all([planFor(athlete, today), getProposal(code, today)]);
  if (!plan) return;
  const session = plan.session;
  if (existing && (existing.status === "approved" || existing.status === "rejected")) return;

  const base = { athlete_code: code, athlete_name: athlete.name, session_label: session.label, on_date: today, created_at: new Date().toISOString(), decided_at: null };
  let row: Omit<ProposalRow, "id" | "coach_note" | "edited_by_coach" | "decided_by">;
  try {
    const active = new Set(activeRules(await allRules(clubOf(code))).map((r) => r.id));
    const ctx = { injuryFlaggedExercises: athlete.protected, clearedExercises: [] as string[] };
    const { proposal, verdict } = decide(await buildScenario(code, today, session, athlete.group, plan.resolved.exercises), active, ctx);
    const dropped = verdict.rejected.map((r) => r.why);
    if (!verdict.reasonOk) {
      row = { ...base, decision: proposal.decision, edits: [], reason: null, rules_applied: [], flag: null, status: "error", error: "Agent reason contained medical language and was discarded. Planned session stands." };
    } else {
      // A proposal whose edits were all stripped by the limits must still reach the coach: the rule fired and the athlete's numbers did not change.
      const strippedAll = dropped.length > 0 && verdict.accepted.length === 0;
      const needsCoach =
        proposal.decision !== "none" &&
        (verdict.accepted.length > 0 || strippedAll || Boolean(proposal.flag_to_coach) || proposal.decision === "rest" || proposal.decision === "flag_only");
      const flag = proposal.flag_to_coach ?? (strippedAll ? "The agent wanted to change this session, but its edits went past the safety limits and were removed. Set the numbers yourself if you agree." : null);
      row = {
        ...base,
        decision: proposal.decision,
        edits: verdict.accepted,
        reason: proposal.reason,
        rules_applied: proposal.rules_applied,
        flag,
        status: needsCoach ? "pending" : "no_change",
        error: dropped.length ? `Limits removed ${dropped.length} edit(s): ${dropped.join("; ")}` : null,
      };
    }
  } catch (e) {
    row = { ...base, decision: null, edits: [], reason: null, rules_applied: [], flag: null, status: "error", error: `Agent unavailable: ${(e as Error).message}` };
  }
  await saveProposal(row);
  await applyIfDelegated(code, row);
}

// Level 2 of the autonomy ladder: a routine suggestion the coach has handed to the agent is applied, and logged as such.
async function applyIfDelegated(code: string, row: Omit<ProposalRow, "id" | "coach_note" | "edited_by_coach" | "decided_by">): Promise<void> {
  if (row.status !== "pending") return;
  const club = clubOf(code);
  const autonomy = await getAutonomy(club);
  if (autonomy.paused || autonomy.delegated.length === 0) return;
  const athlete = await getAthlete(code);
  const rules = (await allRules(club)).map((r) => r.id);
  const stats = ruleStats(await listProposals(club, 500), todayStr(), rules);
  // A player who has not agreed to the current wording is never touched by a handed-over rule.
  const mustAsk = (athlete?.ask_always ?? false) || (athlete?.consent_version ?? 0) < CONSENT_VERSION;
  if (mayAutoApply(row, autonomy, stats, mustAsk)) await decideProposal(club, `${code}_${row.on_date}`, "approved", { by: "delegated" });
}
