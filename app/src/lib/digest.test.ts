import { describe, expect, it } from "vitest";
import { buildDigest } from "./digest";
import type { RosterEntry } from "./views";

const entry = (name: string, status: RosterEntry["status"], checkedIn = false): RosterEntry =>
  ({ athlete: { name } as RosterEntry["athlete"], status, checkin: checkedIn ? ({ note: "sharp pain in my knee" } as RosterEntry["checkin"]) : null, readiness: null, proposal: null, session: null, changed: {}, sleep7: [] });

describe("digest", () => {
  const roster = [entry("Ada Okafor", "needs_decision", true), entry("Ben Silva", "waiting"), entry("Cy Mensah", "on_plan", true), entry("Di Reid", "agent_error", true)];
  const d = buildDigest({ clubName: "Demo FC", date: "2026-10-02", sessionLabel: "Lower", roster, appUrl: "https://app.test" });
  it("lists who needs a decision and who has not checked in", () => {
    expect(d.text).toContain("Need your decision (1): Ada Okafor.");
    expect(d.text).toContain("Not checked in (1): Ben Silva.");
    expect(d.text).toContain("3 of 4 players have checked in.");
    expect(d.text).toContain("No suggestion could be made for: Di Reid");
    expect(d.subject).toBe("Demo FC 2026-10-02 · 1 need you");
  });
  it("carries no health detail", () => {
    expect(d.text).not.toMatch(/pain|knee|sleep|soreness/i);
  });
  it("says so on a quiet morning", () => {
    const q = buildDigest({ clubName: "Demo FC", date: "2026-10-03", sessionLabel: null, roster: [entry("Ada", "on_plan", true)], appUrl: "https://app.test" });
    expect(q.text).toContain("Nothing is waiting on your decision.");
    expect(q.text).toContain("No session is scheduled today.");
    expect(q.subject).toBe("Demo FC 2026-10-03");
  });
});
