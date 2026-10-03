import { dayStr, runAgentFor, todayStr } from "./run-agent";
import {
  clubOf, countSessions, createOverride, createPlayers, deleteAthleteData, deleteSampleSessions, listSampleAthletes, logEvent, replaceSessions, saveCheckin,
  saveReadiness, saveSessionLog, touch,
} from "./store";

// A sample squad: fictional players with two weeks of history, written to the real database but flagged `sample` so the coach can
// see every screen working and remove all of it in one step. It never replaces a club's own program: sample sessions are only added
// when the club has none.
type Ex = { name: string; sets: number; reps: number; load: string; target_rpe: number };
const LOWER: Ex[] = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
  { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
  { name: "Nordic hamstring curl", sets: 3, reps: 5, load: "Bodyweight", target_rpe: 8 },
];
// The reserves train a little more after a match week: one more set of squats and a plyometric.
const LOWER_RESERVES: Ex[] = [{ ...LOWER[0], sets: 5 }, ...LOWER.slice(1), { name: "Box jump", sets: 3, reps: 4, load: "Bodyweight", target_rpe: 6 }];
const UPPER: Ex[] = [
  { name: "Bench press", sets: 4, reps: 6, load: "80% 1RM", target_rpe: 8 },
  { name: "Weighted pull-up", sets: 4, reps: 6, load: "RPE 8", target_rpe: 8 },
  { name: "Overhead press", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
];
const POWER: Ex[] = [
  { name: "Box jump", sets: 4, reps: 4, load: "Bodyweight", target_rpe: 6 },
  { name: "Trap bar deadlift", sets: 4, reps: 4, load: "85% 1RM", target_rpe: 8 },
  { name: "Drop jump", sets: 3, reps: 5, load: "30 cm", target_rpe: 7 },
];
// Training days: every other day for the past fortnight, then the coming week (offset in days from today).
const PLAN: [number, string, Ex[]][] = [
  [-12, "Lower strength", LOWER], [-10, "Upper strength", UPPER], [-8, "Power day", POWER], [-6, "Lower strength", LOWER],
  [-4, "Upper strength", UPPER], [-2, "Power day", POWER], [0, "Lower strength", LOWER], [1, "Upper strength", UPPER],
  [3, "Lower strength", LOWER], [4, "Upper strength", UPPER], [6, "Power day", POWER],
];

type Profile = {
  name: string; shirt: number; position: string; group: string | null; joined: boolean;
  sleep: (i: number) => number; soreness: (i: number) => number; stress: (i: number) => number; rpe: (i: number) => number;
  today?: { sleep: number; soreness: number; stress: number; note?: string };
  device?: { sleep_h: number; hrv_ms: number; resting_hr: number; provider: string };
  override?: boolean;
};
const PROFILES: Profile[] = [
  { name: "Mensah", shirt: 5, position: "Centre-back", group: "Starters", joined: true, sleep: (i) => (i >= 11 ? 5.5 : 7.4), soreness: () => 4, stress: () => 4, rpe: () => 0,
    today: { sleep: 5.4, soreness: 5, stress: 5 }, device: { sleep_h: 5.4, hrv_ms: 41, resting_hr: 58, provider: "whoop" } },
  { name: "Ortiz", shirt: 9, position: "Forward", group: "Starters", joined: true, sleep: () => 7.8, soreness: () => 3, stress: () => 3, rpe: () => 0, today: { sleep: 7.9, soreness: 3, stress: 2 } },
  { name: "Silva", shirt: 8, position: "Midfielder", group: "Starters", joined: true, sleep: () => 7.1, soreness: () => 4, stress: () => 5, rpe: () => 2, today: { sleep: 7.0, soreness: 5, stress: 5 } },
  { name: "Okafor", shirt: 3, position: "Full-back", group: "Reserves", joined: true, sleep: () => 7.3, soreness: () => 3, stress: () => 3, rpe: () => 0,
    today: { sleep: 7.5, soreness: 4, stress: 3, note: "Sharp pain in my right knee on the last set of lunges yesterday." } },
  { name: "Reid", shirt: 1, position: "Goalkeeper", group: "Reserves", joined: true, sleep: (i) => (i % 3 === 0 ? 6.2 : 7.0), soreness: () => 4, stress: (i) => 4 + (i % 4), rpe: (i) => i % 2, override: true },
  { name: "Novak", shirt: 11, position: "Winger", group: null, joined: false, sleep: () => 7, soreness: () => 3, stress: () => 3, rpe: () => 0 },
];

const mean = (ex: Ex[]) => ex.reduce((a, e) => a + e.target_rpe, 0) / ex.length;

export async function loadSampleSquad(club: string): Promise<{ players: number; program: boolean } | "exists"> {
  if ((await listSampleAthletes(club)).length) return "exists";
  const today = todayStr();

  // Sample sessions only when the club has no program of its own. Importing a program later replaces them.
  const program = (await countSessions(club)) === 0;
  if (program) {
    await replaceSessions(club, PLAN.flatMap(([off, label, ex]) => {
      const on_date = dayStr(today, -off);
      const base = { on_date, label, week_type: "normal" as const, exercises: ex, sample: true };
      return label === "Lower strength" ? [base, { ...base, exercises: LOWER_RESERVES, group: "Reserves" }] : [base];
    }));
  }

  const codes = await createPlayers(
    club,
    PROFILES.map((p) => ({ name: p.name, shirt: p.shirt, position: p.position, squad: "First team", group: p.group, consented: p.joined })),
    { sample: true },
  );
  const pastDates = PLAN.filter(([off]) => off < 0).map(([off, , ex]) => ({ date: dayStr(today, -off), target: mean(ex) }));

  for (const [idx, p] of PROFILES.entries()) {
    const code = codes[idx];
    if (!p.joined) continue;
    for (let i = 0; i < 13; i++) await saveCheckin(code, dayStr(today, 13 - i), { sleep_h: p.sleep(i), soreness: p.soreness(i), stress: p.stress(i), note: null });
    if (program) for (const [i, { date, target }] of pastDates.entries()) await saveSessionLog(code, date, Math.round((target + p.rpe(i)) * 2) / 2);
    if (p.device) await saveReadiness(code, today, p.device);
    if (p.override && program) {
      await createOverride(code, {
        exercise: "Nordic hamstring curl", swap_to: "Hamstring slider curl", max_sets: 2, max_reps: null, load_pct: null,
        until: null, review_on: dayStr(today, -3), note: "Sample: returning from a hamstring strain, building back up.", created_by: "Sample data",
      });
    }
    if (p.today) {
      const t = p.today;
      await saveCheckin(code, today, { sleep_h: t.sleep, soreness: t.soreness, stress: t.stress, note: t.note ?? null });
      await logEvent(club, { type: "checkin", athlete_code: code, athlete_name: p.name, text: `${p.name} checked in: ${t.sleep} h sleep, soreness ${t.soreness}, stress ${t.stress}${t.note ? ", with a note" : ""}` });
      await runAgentFor(code, today);
    }
  }
  await logEvent(club, { type: "sample", athlete_code: null, athlete_name: null, text: `Sample squad loaded: ${PROFILES.length} fictional players with two weeks of history` });
  await touch(club, "coach");
  return { players: PROFILES.length, program };
}

// Removes every sample player (with their answers, proposals and plan changes) and any sample sessions. Real data is never touched.
export async function removeSampleSquad(club: string): Promise<number> {
  const sample = await listSampleAthletes(club);
  for (const a of sample) if (clubOf(a.code) === club) await deleteAthleteData(a.code, { quiet: true });
  await deleteSampleSessions(club);
  await logEvent(club, { type: "sample", athlete_code: null, athlete_name: null, text: "Sample squad removed" });
  await touch(club, "coach");
  return sample.length;
}
