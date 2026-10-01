import { readFileSync } from "node:fs";
import path from "node:path";
import db from "./db";
import { propose, type Scenario } from "./agent/propose";
import type { Exercise } from "./agent/schema";

type SessionRow = { id: number; on_date: string; label: string; week_type: string; exercises: string };

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

function buildScenario(athleteId: number, today: string, session: SessionRow): Scenario {
  const days = [];
  for (let back = 13; back >= 0; back--) {
    const date = dayStr(today, back);
    const c = db.prepare("select * from checkin where athlete_id = ? and on_date = ?").get(athleteId, date) as
      | { sleep_h: number; soreness: number; stress: number; note: string | null } | undefined;
    const log = db.prepare("select rpe from session_log where athlete_id = ? and on_date = ?").get(athleteId, date) as { rpe: number } | undefined;
    const planned = db.prepare("select exercises from session where on_date = ? limit 1").get(date) as { exercises: string } | undefined;
    const target = planned ? meanTarget(JSON.parse(planned.exercises)) : null;
    days.push({
      day: -back,
      sleep_h: c?.sleep_h ?? null,
      stress: c?.stress ?? null,
      soreness: { overall: c?.soreness ?? null, by_region: {} },
      session: log ? { completed: true, rpe_delta: target == null ? null : Math.round((log.rpe - target) * 10) / 10 } : null,
      note: c?.note || null,
    });
  }
  return {
    athlete: { age_group: "adult" },
    planned_session: { label: session.label, week_type: session.week_type, exercises: JSON.parse(session.exercises) },
    last_14_days: days,
  };
}

export async function runAgentFor(athleteId: number, today: string): Promise<void> {
  const session = db.prepare("select * from session where on_date = ? order by id limit 1").get(today) as SessionRow | undefined;
  if (!session) return;
  const existing = db.prepare("select status from proposal where athlete_id = ? and on_date = ?").get(athleteId, today) as { status: string } | undefined;
  if (existing && (existing.status === "approved" || existing.status === "rejected")) return;

  let row: { decision: string | null; edits: string; reason: string | null; rules: string; flag: string | null; status: string; error: string | null };
  try {
    const { proposal, verdict } = await propose(buildScenario(athleteId, today, session), loadRules());
    const dropped = verdict.rejected.map((r) => r.why);
    if (!verdict.reasonOk) {
      row = { decision: proposal.decision, edits: "[]", reason: null, rules: "[]", flag: null, status: "error", error: "Agent reason contained medical language and was discarded. Planned session stands." };
    } else {
      const needsCoach = proposal.decision !== "none" && (verdict.accepted.length > 0 || Boolean(proposal.flag_to_coach) || proposal.decision === "rest" || proposal.decision === "flag_only");
      row = {
        decision: proposal.decision,
        edits: JSON.stringify(verdict.accepted),
        reason: proposal.reason,
        rules: JSON.stringify(proposal.rules_applied),
        flag: proposal.flag_to_coach ?? null,
        status: needsCoach ? "pending" : "no_change",
        error: dropped.length ? `Limits removed ${dropped.length} edit(s): ${dropped.join("; ")}` : null,
      };
    }
  } catch (e) {
    row = { decision: null, edits: "[]", reason: null, rules: "[]", flag: null, status: "error", error: `Agent unavailable: ${(e as Error).message}` };
  }
  db.prepare("delete from proposal where athlete_id = ? and on_date = ?").run(athleteId, today);
  db.prepare(
    "insert into proposal (athlete_id, session_id, on_date, decision, edits, reason, rules_applied, flag, status, error, created_at) values (?,?,?,?,?,?,?,?,?,?,?)",
  ).run(athleteId, session.id, today, row.decision, row.edits, row.reason, row.rules, row.flag, row.status, row.error, new Date().toISOString());
}
