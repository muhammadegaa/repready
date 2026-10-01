// Fills the LOCAL Firestore emulator with a believable week: six athletes, two weeks of history, today's program.
// Refuses to run unless FIRESTORE_EMULATOR_HOST is set. Usage:
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 npx tsx --env-file=.env.local scripts/seed-demo.mts [--no-agent]
import { dayStr, runAgentFor, todayStr } from "../src/lib/run-agent";
import {
  createAthlete, giveConsentTo, logEvent, replaceSessions, saveCheckin, saveReadiness, saveSessionLog, touch,
} from "../src/lib/store";

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("Refusing to seed: FIRESTORE_EMULATOR_HOST is not set, so this would write to the real database.");
const project = process.env.FIREBASE_PROJECT_ID ?? "repready-7dacd";
const useAgent = !process.argv.includes("--no-agent");

const wipe = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
if (!wipe.ok) throw new Error(`Could not clear the emulator: ${wipe.status}`);

const today = todayStr();
const LOWER = [
  { name: "Back squat", sets: 4, reps: 5, load: "85% 1RM", target_rpe: 8 },
  { name: "Romanian deadlift", sets: 3, reps: 8, load: "70% 1RM", target_rpe: 7 },
  { name: "Split squat", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
  { name: "Nordic hamstring curl", sets: 3, reps: 5, load: "Bodyweight", target_rpe: 8 },
];
const UPPER = [
  { name: "Bench press", sets: 4, reps: 6, load: "80% 1RM", target_rpe: 8 },
  { name: "Weighted pull-up", sets: 4, reps: 6, load: "RPE 8", target_rpe: 8 },
  { name: "Overhead press", sets: 3, reps: 8, load: "RPE 7", target_rpe: 7 },
];
const POWER = [
  { name: "Box jump", sets: 4, reps: 4, load: "Bodyweight", target_rpe: 6 },
  { name: "Trap bar deadlift", sets: 4, reps: 4, load: "85% 1RM", target_rpe: 8 },
  { name: "Drop jump", sets: 3, reps: 5, load: "30 cm", target_rpe: 7 },
];
// Training days: every other day for the past fortnight, then the coming week.
const plan: [number, string, typeof LOWER][] = [
  [-12, "Lower strength", LOWER], [-10, "Upper strength", UPPER], [-8, "Power day", POWER], [-6, "Lower strength", LOWER],
  [-4, "Upper strength", UPPER], [-2, "Power day", POWER], [0, "Lower strength", LOWER], [1, "Upper strength", UPPER],
  [3, "Lower strength", LOWER], [4, "Upper strength", UPPER], [6, "Power day", POWER],
];
await replaceSessions(plan.map(([off, label, ex]) => ({ on_date: dayStr(today, -off), label, week_type: "normal", exercises: ex })));
const pastSessions = plan.filter(([off]) => off < 0).map(([off]) => dayStr(today, -off));

type Profile = { name: string; joined: boolean; sleep: (i: number) => number; soreness: (i: number) => number; stress: (i: number) => number; rpe: (i: number) => number; todayIn?: { sleep: number; soreness: number; stress: number; note?: string } };
const profiles: Profile[] = [
  { name: "Maya", joined: true, sleep: (i) => (i >= 11 ? 5.5 : 7.4), soreness: () => 4, stress: () => 4, rpe: () => 0, todayIn: { sleep: 5.4, soreness: 5, stress: 5 } },
  { name: "Tomás", joined: true, sleep: () => 7.8, soreness: () => 3, stress: () => 3, rpe: () => 0, todayIn: { sleep: 7.9, soreness: 3, stress: 2 } },
  { name: "Priya", joined: true, sleep: () => 7.1, soreness: () => 4, stress: () => 5, rpe: () => 2, todayIn: { sleep: 7.0, soreness: 5, stress: 5 } },
  { name: "Aisha", joined: true, sleep: () => 7.3, soreness: () => 3, stress: () => 3, rpe: () => 0, todayIn: { sleep: 7.5, soreness: 4, stress: 3, note: "Sharp pain in my right knee on the last set of lunges yesterday." } },
  { name: "Dan", joined: true, sleep: (i) => (i % 3 === 0 ? 6.2 : 7.0), soreness: () => 4, stress: (i) => 4 + (i % 4), rpe: (i) => (i % 2) },
  { name: "Leo", joined: false, sleep: () => 7, soreness: () => 3, stress: () => 3, rpe: () => 0 },
];

const codes: { code: string; p: Profile }[] = [];
for (const p of profiles) codes.push({ code: await createAthlete(p.name), p });

for (const { code, p } of codes) {
  if (!p.joined) continue;
  await giveConsentTo(code);
  for (let i = 0; i < 13; i++) {
    const date = dayStr(today, 13 - i);
    await saveCheckin(code, date, { sleep_h: p.sleep(i), soreness: p.soreness(i), stress: p.stress(i), note: null });
  }
  for (const date of pastSessions) {
    const target = (plan.find(([off]) => dayStr(today, -off) === date)![2].reduce((a, e) => a + (e.target_rpe ?? 0), 0)) / plan.find(([off]) => dayStr(today, -off) === date)![2].length;
    await saveSessionLog(code, date, Math.round((target + p.rpe(pastSessions.indexOf(date))) * 2) / 2);
  }
}

// Maya's night comes from a wearable.
const maya = codes.find((c) => c.p.name === "Maya")!;
await saveReadiness(maya.code, today, { sleep_h: 5.4, hrv_ms: 41, resting_hr: 58, provider: "whoop" });

for (const { code, p } of codes) {
  if (!p.todayIn) continue;
  const t = p.todayIn;
  await saveCheckin(code, today, { sleep_h: t.sleep, soreness: t.soreness, stress: t.stress, note: t.note ?? null });
  await logEvent({ type: "checkin", athlete_code: code, athlete_name: p.name, text: `${p.name} checked in: ${t.sleep} h sleep, soreness ${t.soreness}, stress ${t.stress}${t.note ? ", with a note" : ""}` });
  if (useAgent) await runAgentFor(code, today);
}
await touch("coach", "science");
console.log(`Seeded ${codes.length} athletes. ${useAgent ? "Agent ran for" : "Agent skipped for"} ${profiles.filter((p) => p.todayIn).length} check-ins.`);
for (const { code, p } of codes) console.log(`${p.name.padEnd(6)} /a/${code}`);
