import { describe, expect, it } from "vitest";
import { summarise } from "./results";
import type { ProposalRow } from "./store";

const p = (status: ProposalRow["status"], hours = 2, edited = false): ProposalRow => ({
  id: "x", athlete_code: "a", athlete_name: "A", session_label: "L", on_date: "2026-10-01", decision: null, edits: [], reason: null, rules_applied: [], flag: null,
  status, error: null, created_at: "2026-10-01T07:00:00.000Z", decided_at: status === "pending" ? null : new Date(Date.parse("2026-10-01T07:00:00.000Z") + hours * 3_600_000).toISOString(), coach_note: null, edited_by_coach: edited, decided_by: null,
});

describe("summarise", () => {
  it("rates check-ins against players x days and counts what the coach did with suggestions", () => {
    const r = summarise({ days: 14, players: 10, checkins: 105, proposals: [p("approved", 1, true), p("approved", 3), p("rejected", 2), p("pending"), p("no_change"), p("error")] });
    expect(r.checkinRate).toBeCloseTo(0.75);
    expect(r).toMatchObject({ suggestions: 4, approved: 2, keptPlan: 1, pending: 1, changedByCoach: 1, medianHoursToDecide: 2 });
  });
  it("has no rate with no players, and no median with nothing decided", () => {
    const r = summarise({ days: 14, players: 0, checkins: 0, proposals: [] });
    expect(r.checkinRate).toBeNull();
    expect(r.medianHoursToDecide).toBeNull();
  });
});
