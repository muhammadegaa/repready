import { describe, expect, it } from "vitest";
import { milestones, signals, stageOf, type ClubFacts } from "./pilot";

const base: ClubFacts = { id: "abc123", name: "FC", daysOld: 10, paid: true, players: 20, consented: 18, sessions: 5, checkins7: 90, possible7: 140, proposals7: 10, decided7: 9 };

describe("pilot health", () => {
  it("reaches all four milestones for a club that is working", () => {
    expect(milestones(base).every((m) => m.done)).toBe(true);
    expect(stageOf(base)).toBe("All four milestones reached");
    expect(signals(base)).toEqual([]);
  });
  it("names the first milestone not reached", () => {
    expect(stageOf({ ...base, sessions: 0 })).toBe("Program confirmed");
    expect(stageOf({ ...base, consented: 2 })).toBe("Players agreed on their own phones");
    expect(stageOf({ ...base, checkins7: 20 })).toBe("Half the squad checking in (last 7 days)");
    expect(stageOf({ ...base, decided7: 2 })).toBe("Coach deciding most days");
  });
  it("calls out a club that is drifting: coach only, silent, unpaid, or sitting on suggestions", () => {
    expect(signals({ ...base, consented: 0 })).toContain("Coach set up, no players have joined");
    expect(signals({ ...base, checkins7: 0 })).toContain("No check-ins in 7 days");
    expect(signals({ ...base, paid: false })).toContain("Not subscribed yet");
    expect(signals({ ...base, proposals7: 8, decided7: 3 })).toContain("Suggestions waiting on the coach");
    expect(signals({ ...base, daysOld: 2, sessions: 0, consented: 0, paid: true })).toEqual([]); // too early to worry
  });
});
