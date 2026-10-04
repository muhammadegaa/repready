// How a pilot club is doing, for the person running the pilot. Four milestones in the order they should happen, and the signals that
// a club is drifting before it says so. Nothing here is shown to clubs.
export type ClubFacts = {
  id: string; name: string; daysOld: number; paid: boolean;
  players: number; consented: number; sessions: number;
  checkins7: number; possible7: number; proposals7: number; decided7: number;
};

export type Milestone = { key: "program" | "players" | "checkins" | "decisions"; label: string; done: boolean };

export function milestones(f: ClubFacts): Milestone[] {
  const rate = f.possible7 ? f.checkins7 / f.possible7 : 0;
  return [
    { key: "program", label: "Program confirmed", done: f.sessions > 0 },
    { key: "players", label: "Players agreed on their own phones", done: f.players > 0 && f.consented >= Math.min(5, f.players) },
    { key: "checkins", label: "Half the squad checking in (last 7 days)", done: rate >= 0.5 },
    { key: "decisions", label: "Coach deciding most days", done: f.proposals7 > 0 && f.decided7 / f.proposals7 >= 0.7 },
  ];
}

export function signals(f: ClubFacts): string[] {
  const out: string[] = [];
  if (!f.paid && f.daysOld >= 1) out.push("Not subscribed yet");
  if (f.daysOld >= 7 && f.sessions === 0) out.push("No program after a week");
  if (f.daysOld >= 7 && f.consented === 0) out.push("Coach set up, no players have joined");
  if (f.consented > 0 && f.daysOld >= 7 && f.checkins7 === 0) out.push("No check-ins in 7 days");
  if (f.proposals7 - f.decided7 >= 3) out.push("Suggestions waiting on the coach");
  return out;
}

export const stageOf = (f: ClubFacts) => milestones(f).find((m) => !m.done)?.label ?? "All four milestones reached";
