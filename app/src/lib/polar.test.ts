import { beforeAll, describe, expect, it } from "vitest";
import { authorizeUrl, signState, toReadiness, verifyState } from "./polar";

beforeAll(() => {
  process.env.POLAR_CLIENT_ID = "client-1";
  process.env.POLAR_CLIENT_SECRET = "secret-1";
});

const CODE = "abc1230123456789";

describe("OAuth state", () => {
  it("round-trips for the same browser and rejects anything else", () => {
    const now = 1_000_000;
    const state = signState(CODE, "aabbccdd11223344", now);
    expect(verifyState(state, "aabbccdd11223344", now + 1000)).toBe(CODE);
    expect(verifyState(state, "ffffffffffffffff", now + 1000)).toBeNull(); // different browser
    expect(verifyState(state, undefined, now + 1000)).toBeNull();
    expect(verifyState(state.replace(CODE, "9999999999"), "aabbccdd11223344", now + 1000)).toBeNull(); // tampered
    expect(verifyState(state, "aabbccdd11223344", now + 16 * 60_000)).toBeNull(); // expired
    expect(verifyState("garbage", "x")).toBeNull();
  });
});

describe("authorizeUrl", () => {
  it("asks for the read scope and carries the signed state and our callback", () => {
    const u = new URL(authorizeUrl(CODE, "aabbccdd11223344", "https://app.example"));
    expect(u.origin + u.pathname).toBe("https://flow.polar.com/oauth2/authorization");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("client_id")).toBe("client-1");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example/api/polar/callback");
    expect(u.searchParams.get("scope")).toBe("accesslink.read_all");
    expect(u.searchParams.get("state")?.startsWith(`${CODE}.aabbccdd11223344.`)).toBe(true);
  });
});

describe("toReadiness", () => {
  it("sums sleep stages to hours, joins HRV by date and uses the lowest night heart rate", () => {
    const m = toReadiness(
      [{ date: "2026-10-01", light_sleep: 12000, deep_sleep: 4000, rem_sleep: 5000, heart_rate_samples: { "00:41": 61, "01:00": 52, "02:00": 58 } }],
      [{ date: "2026-10-01", heart_rate_variability_avg: 47.6 }],
    );
    expect(m.get("2026-10-01")).toEqual({ sleep_h: 5.8, hrv_ms: 48, resting_hr: 52, provider: "polar" });
  });
  it("falls back to start and end time minus interruptions when stages are missing", () => {
    const m = toReadiness([{ date: "2026-10-02", sleep_start_time: "2026-10-02T00:00:00+01:00", sleep_end_time: "2026-10-02T07:00:00+01:00", total_interruption_duration: 3600 }], []);
    expect(m.get("2026-10-02")).toEqual({ sleep_h: 6, hrv_ms: null, resting_hr: null, provider: "polar" });
  });
  it("skips nights with no usable sleep or a bad date, and ignores implausible heart rates", () => {
    const m = toReadiness([{ date: "2026-10-03" }, { date: "bad", light_sleep: 20000 }, { date: "2026-10-04", light_sleep: 20000, heart_rate_samples: { a: 0, b: 400 } }], []);
    expect([...m.keys()]).toEqual(["2026-10-04"]);
    expect(m.get("2026-10-04")?.resting_hr).toBeNull();
  });
});
