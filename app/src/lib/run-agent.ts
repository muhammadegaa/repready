import { readFileSync } from "node:fs";
import path from "node:path";
import { propose, type Scenario } from "./agent/propose";
import type { Exercise } from "./agent/schema";
import { getAthlete, getCheckins, getProposal, getReadinessOn, getSessionLogs, saveProposal, sessionOn, sessionsOnDates, type ProposalRow, type SessionRow } from "./store";

export const todayStr = () => new Date().toISOString().slice(0, 10);

const dayStr = (today: string, back: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

function loadRules() {
  const file = JSON.parse(readFileSync(path.join(process.cwd(), "..", "eval", "rules.json"), "utf8"));
  return file.rules.filter((r: { keep: string | null }) => r.keep !== "delete");
}

function meanTarget(ex: Exercise[]): number | null {
  const t = ex.map((e) => e.target_rpe).filter((x): x is number => typeof x === "number");
  return t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
}

async function buildScenario(code: string, today: string, session: SessionRow): Promise<Scenario> {
  const dates = Array.from({ length: 14 }, (_, i) => dayStr(today, 13 - i));
  const [checkins, logs, sessions, readiness] = await Promise.all([
    getCheckins(code, dates),
    getSessionLogs(code, dates),
    sessionsOnDates(dates),
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
      note: c?.note || null,
    };
  });
  return {
    athlete: { age_group: "adult" },
    planned_session: { label: session.label, week_type: session.week_type, exercises: session.exercises },
    last_14_days: days,
  };
}

export async function runAgentFor(code: string, today: string): Promise<void> {
  const [athlete, session, existing] = await Promise.all([getAthlete(code), sessionOn(today), getProposal(code, today)]);
  if (!athlete || !session) return;
  if (existing && (existing.status === "approved" || existing.status === "rejected")) return;

  const base = { athlete_code: code, athlete_name: athlete.name, session_label: session.label, on_date: today, created_at: new Date().toISOString(), decided_at: null };
  let row: Omit<ProposalRow, "id">;
  try {
    const { proposal, verdict } = await propose(await buildScenario(code, today, session), loadRules());
    const dropped = verdict.rejected.map((r) => r.why);
    if (!verdict.reasonOk) {
      row = { ...base, decision: proposal.decision, edits: [], reason: null, rules_applied: [], flag: null, status: "error", error: "Agent reason contained medical language and was discarded. Planned session stands." };
    } else {
      const needsCoach =
        proposal.decision !== "none" &&
        (verdict.accepted.length > 0 || Boolean(proposal.flag_to_coach) || proposal.decision === "rest" || proposal.decision === "flag_only");
      row = {
        ...base,
        decision: proposal.decision,
        edits: verdict.accepted,
        reason: proposal.reason,
        rules_applied: proposal.rules_applied,
        flag: proposal.flag_to_coach ?? null,
        status: needsCoach ? "pending" : "no_change",
        error: dropped.length ? `Limits removed ${dropped.length} edit(s): ${dropped.join("; ")}` : null,
      };
    }
  } catch (e) {
    row = { ...base, decision: null, edits: [], reason: null, rules_applied: [], flag: null, status: "error", error: `Agent unavailable: ${(e as Error).message}` };
  }
  await saveProposal(row);
}
