import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOuraSleep, ouraToReadiness } from "./oura";

describe("oura mapping (fixtures written from the documented fields, not captured from the API)", () => {
  it("maps the main sleep of a night", () => {
    const m = ouraToReadiness([{ day: "2026-10-01", type: "long_sleep", total_sleep_duration: 20880, average_hrv: 47.6, lowest_heart_rate: 51 }]);
    expect(m.get("2026-10-01")).toEqual({ sleep_h: 5.8, hrv_ms: 48, resting_hr: 51, provider: "oura" });
  });
  it("ignores naps and deleted sessions, and takes the longer of two long sleeps", () => {
    const m = ouraToReadiness([
      { day: "2026-10-01", type: "late_nap", total_sleep_duration: 3600 },
      { day: "2026-10-01", type: "deleted", total_sleep_duration: 30000 },
      { day: "2026-10-01", type: "long_sleep", total_sleep_duration: 18000 },
      { day: "2026-10-01", type: "long_sleep", total_sleep_duration: 25200 },
    ]);
    expect(m.size).toBe(1);
    expect(m.get("2026-10-01")?.sleep_h).toBe(7);
  });
  it("drops nights with no usable duration and keeps missing HRV as null", () => {
    const m = ouraToReadiness([
      { day: "2026-09-30", type: "long_sleep", total_sleep_duration: 0 },
      { day: "2026-10-02", type: "long_sleep", total_sleep_duration: 27000 },
    ]);
    expect(m.has("2026-09-30")).toBe(false);
    expect(m.get("2026-10-02")).toEqual({ sleep_h: 7.5, hrv_ms: null, resting_hr: null, provider: "oura" });
  });
});

describe("fetchOuraSleep", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("follows pages and uses the sandbox path when asked", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (u: URL) => {
      calls.push(String(u));
      const first = !u.searchParams.get("next_token");
      return new Response(JSON.stringify({ data: [{ day: first ? "2026-10-01" : "2026-10-02", type: "long_sleep" }], next_token: first ? "abc" : null }));
    });
    const docs = await fetchOuraSleep("t", "2026-10-01", "2026-10-02", true);
    expect(docs.length).toBe(2);
    expect(calls[0]).toContain("/sandbox/usercollection/sleep");
    expect(calls[1]).toContain("next_token=abc");
  });
  it("reports a revoked token plainly", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 401 }));
    await expect(fetchOuraSleep("t", "a", "b")).rejects.toThrow(/revoked/);
  });
});
